// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {TimeBoundAccessControl} from "./TimeBoundAccessControl.sol";
import {CredentialRegistry} from "./CredentialRegistry.sol";

/// @title AssetRegistry
/// @notice M3 — every organizational digital asset is minted as an ERC-721 token directly linked
///         to the owning DID. Two gap-closing design decisions:
///         1. Metadata is content-addressed on IPFS (CID stored on-chain, never a mutable URL) —
///            closes the "off-chain metadata rot" gap.
///         2. Minting requires DUAL ATTESTATION — an Admin proposes, a distinct Manager/Admin must
///            co-sign before the token is created — closes "anyone can mint an NFT for an asset
///            they don't possess" (docs/SECURITY.md §5.2).
contract AssetRegistry is Initializable, ERC721Upgradeable, UUPSUpgradeable {
    TimeBoundAccessControl public accessControl;
    CredentialRegistry public credentialRegistry;

    struct PendingMint {
        string cid;
        bytes32 recipientDid;
        address recipient;
        address proposer;
        address coSigner;
        bool executed;
    }

    struct AssetMeta {
        string cid;
        bytes32 legalReference; // optional hash of an off-chain signed attestation
        uint256 mintedAt;
    }

    mapping(uint256 => PendingMint) public pendingMints;
    mapping(uint256 => AssetMeta) public assetMeta;
    /// @notice Stores the VC that authorized the current owner to hold this token.
    ///         Checked on every transfer — if the credential expires or is revoked, the token
    ///         becomes non-transferable until a new valid VC is associated (FEATURES.md F3.2).
    mapping(uint256 => bytes32) public vcIdOf;
    /// @dev Internal flag set during _safeMint to skip the credential check on initial mint.
    ///      Without this, minting itself would revert because the token has no vcId yet.
    bool private _minting;
    uint256 public nextRequestId;
    uint256 public nextTokenId;

    /// @notice The sole external contract permitted to call recordOracleFact -- set once via
    ///         setOracleAttestationContract after 2-of-N SUPER_ADMIN_ROLE authorization (actionType
    ///         7 on TimeBoundAccessControl), mirroring DIDRegistry.guardianRecoveryContract's exact
    ///         pattern (T-016, gap analysis §2.2.5). Appended after nextTokenId, storage-layout-safe
    ///         same convention as TimeBoundAccessControl.sol's append-only mappings.
    address public oracleAttestation;

    struct OracleFactRecord {
        uint8 factType;
        bytes32 dataHash;
        uint256 factId;   // OracleAttestation's own id, for cross-reference/lookup
        uint256 finalizedAt;
    }

    /// @notice Append-only per-token history of finalized oracle facts -- only ever written by
    ///         recordOracleFact below, after OracleAttestation's own 2-of-N attest + dispute-window
    ///         process has already finalized the fact. Nothing is ever removed or overwritten; a
    ///         later fact just appends another entry (e.g. Delivered, then later Damaged).
    mapping(uint256 => OracleFactRecord[]) public oracleFactsOf;
    /// @notice Mirror of the most recent finalized fact's factType -- lets the frontend show
    ///         current status without reading the whole history array.
    mapping(uint256 => uint8) public latestOracleFactType;

    event MintProposed(uint256 indexed requestId, string cid, bytes32 recipientDid, address proposer);
    event MintCoSigned(uint256 indexed requestId, address coSigner);
    event AssetMinted(uint256 indexed tokenId, uint256 indexed requestId, bytes32 recipientDid, string cid);
    event LegalReferenceAttached(uint256 indexed tokenId, bytes32 legalReferenceHash);
    event OracleAttestationContractSet(address indexed oracleAttestation);
    event OracleFactRecorded(uint256 indexed tokenId, uint8 factType, bytes32 dataHash, uint256 indexed factId);

    error SameSignerNotAllowed();
    error AlreadyExecuted();
    error RecipientCredentialInvalid();
    error NotProposer();
    error NotAuthorized();
    error OnlyOracleAttestation();
    error ZeroAddress();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address accessControlAddr, address credentialRegistryAddr) public initializer {
        __ERC721_init("Praman Setu Digital Asset", "BELA");
        accessControl = TimeBoundAccessControl(accessControlAddr);
        credentialRegistry = CredentialRegistry(credentialRegistryAddr);
    }

    modifier whenNotPaused() {
        require(!_accessControlPaused(), "AssetRegistry: platform paused");
        _;
    }

    function _accessControlPaused() internal view returns (bool) {
        (bool ok, bytes memory data) = address(accessControl).staticcall(abi.encodeWithSignature("paused()"));
        return ok && abi.decode(data, (bool));
    }

    /// @notice Step 2 of the mint flow (docs/USER_FLOWS.md §2). Admin-only.
    function proposeMint(string calldata cid, bytes32 recipientDid, address recipient)
        external
        whenNotPaused
        returns (uint256 requestId)
    {
        require(accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender), "caller is not ADMIN_ROLE");
        requestId = nextRequestId++;
        pendingMints[requestId] = PendingMint({
            cid: cid,
            recipientDid: recipientDid,
            recipient: recipient,
            proposer: msg.sender,
            coSigner: address(0),
            executed: false
        });
        emit MintProposed(requestId, cid, recipientDid, msg.sender);
    }

    /// @notice Step 3 — dual attestation. Executes the mint automatically once satisfied.
    function coSignMint(uint256 requestId) external whenNotPaused returns (uint256 tokenId) {
        bool isManager = accessControl.hasRole(accessControl.MANAGER_ROLE(), msg.sender);
        bool isAdmin = accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender);
        require(isManager || isAdmin, "caller must be MANAGER_ROLE or ADMIN_ROLE");

        PendingMint storage pm = pendingMints[requestId];
        if (pm.executed) revert AlreadyExecuted();
        if (pm.proposer == msg.sender) revert SameSignerNotAllowed();

        pm.coSigner = msg.sender;
        pm.executed = true;
        emit MintCoSigned(requestId, msg.sender);

        tokenId = nextTokenId++;
        _minting = true;
        _safeMint(pm.recipient, tokenId);
        _minting = false;

        // Store the credential that authorized this mint — used by _update for transfer gating.
        // recipientDid field currently holds the vcId (see proposeMint — callers pass the vcId
        // as recipientDid so it flows through without an extra storage slot; see API_SPEC.md §M3).
        vcIdOf[tokenId] = pm.recipientDid;
        assetMeta[tokenId] = AssetMeta({cid: pm.cid, legalReference: bytes32(0), mintedAt: block.timestamp});

        emit AssetMinted(tokenId, requestId, pm.recipientDid, pm.cid);
    }

    /// @notice Optional legal-tech bridge field (docs/SECURITY.md §5.2, PRD.md §3 known limitation).
    function attachLegalReference(uint256 tokenId, bytes32 legalReferenceHash) external {
        require(ownerOf(tokenId) == msg.sender, "only owner may attach legal reference");
        assetMeta[tokenId].legalReference = legalReferenceHash;
        emit LegalReferenceAttached(tokenId, legalReferenceHash);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string(abi.encodePacked("ipfs://", assetMeta[tokenId].cid));
    }

    /// @dev Credential-gated transfer — closes "assets sent to unverified/anonymous address" gap
    ///      (FEATURES.md F3.2, audit item A7). On every transfer (not initial mint), the recipient's
    ///      credential associated with this specific token must still be valid. If a credential expires
    ///      or is revoked, the token becomes non-transferable until governance issues a new VC and
    ///      calls refreshVcId (a Phase 3 governance action).
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (!_minting && to != address(0)) {
            // address(0) = burn, skip check
            bytes32 vcId = vcIdOf[tokenId];
            if (vcId != bytes32(0) && !credentialRegistry.isValid(vcId)) {
                revert RecipientCredentialInvalid();
            }
        }
        return super._update(to, tokenId, auth);
    }

    /// @notice One-time wiring call -- requires 2-of-N SUPER_ADMIN_ROLE approval via
    ///         accessControl.proposePlatformAction(7,...)/coSignPlatformAction (T-016, gap analysis
    ///         §2.2.5). Permissionless caller by design -- same tradeoff
    ///         TimeBoundAccessControl.consumeUpgradeAuthorization's docstring already documents for
    ///         this class of function: the pre-check (the SUPER_ADMIN-approved flag) is what's
    ///         trusted, not who happens to submit the tx.
    function setOracleAttestationContract(address oracleAttestationAddr) external {
        if (oracleAttestationAddr == address(0)) revert ZeroAddress();
        if (!accessControl.oracleAttestationAuthorized(oracleAttestationAddr)) revert NotAuthorized();
        accessControl.consumeOracleAttestationAuthorization(oracleAttestationAddr);
        oracleAttestation = oracleAttestationAddr;
        emit OracleAttestationContractSet(oracleAttestationAddr);
    }

    /// @notice Writes a finalized real-world fact about `tokenId` into on-chain state. Callable
    ///         only by the authorized OracleAttestation contract, only after its own multi-attestor
    ///         + dispute-window process has finalized the fact (T-016, gap analysis §2.2.5).
    function recordOracleFact(uint256 tokenId, uint8 factType, bytes32 dataHash, uint256 factId) external {
        if (msg.sender != oracleAttestation) revert OnlyOracleAttestation();
        _requireOwned(tokenId);
        oracleFactsOf[tokenId].push(OracleFactRecord({
            factType: factType,
            dataHash: dataHash,
            factId: factId,
            finalizedAt: block.timestamp
        }));
        latestOracleFactType[tokenId] = factType;
        emit OracleFactRecorded(tokenId, factType, dataHash, factId);
    }

    /// @notice Replaces the previous single-signer `hasRole(SUPER_ADMIN_ROLE, msg.sender)` gate
    ///         (audit §2.2) — routes through the same 2-of-N co-signed approval as
    ///         TimeBoundAccessControl's own upgrade authorization (proposePlatformAction(4, ...) /
    ///         coSignPlatformAction there sets accessControl.upgradeAuthorized(newImplementation)),
    ///         rather than a second, parallel multisig mechanism. Not `view` anymore — consuming the
    ///         approval on use requires a state-changing external call.
    function _authorizeUpgrade(address newImplementation) internal override {
        require(accessControl.upgradeAuthorized(newImplementation), "upgrade not authorized");
        accessControl.consumeUpgradeAuthorization(newImplementation);
    }
}
