// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TimeBoundAccessControl} from "./TimeBoundAccessControl.sol";
import {AssetRegistry} from "./AssetRegistry.sol";

/// @title OracleAttestation
/// @notice M6 — decentralized oracle design with multiple independent attestors and a dispute
///         window before an oracle-fed real-world fact (e.g. "this physical asset was delivered")
///         becomes final on-chain (gap analysis §2.2.5, TODO.md T-016). Distinct from
///         AssetRegistry.proposeMint/coSignMint's dual attestation (that closes mint fraud only —
///         a fixed-shape, mint-time-only check). This contract attests arbitrary post-mint
///         real-world facts about an already-minted token, on an ongoing basis, with its own
///         2-of-N ORACLE_ATTESTOR_ROLE threshold and a short cooling-off/dispute window — same
///         propose->co-sign->dispute->resolve shape as GovernanceTimelock.sol, applied to oracle
///         facts instead of arbitrary queued calldata.
contract OracleAttestation {
    TimeBoundAccessControl public immutable accessControl;
    AssetRegistry public immutable assetRegistry;

    uint8 public constant ATTESTATION_THRESHOLD = 2; // 2-of-N ORACLE_ATTESTOR_ROLE, same precedent
                                                       // as GRANT_THRESHOLD/ACTION_THRESHOLD/
                                                       // QUEUE_THRESHOLD elsewhere in this system.
    /// @notice Intentionally short vs. GovernanceTimelock's 24-48h MIN_DELAY/MAX_DELAY -- live-demo
    ///         scale, per explicit instruction, not a production security parameter. A real
    ///         deployment should make this configurable (or at minimum much longer) before an
    ///         oracle-fed fact is trusted for anything higher-stakes than a hackathon demo.
    uint256 public constant DISPUTE_WINDOW = 15 minutes;

    enum Status { Submitted, Attested, Disputed, Finalized, Rejected }

    struct OracleFact {
        uint256 tokenId;
        uint8 factType;       // opaque to this contract and to AssetRegistry beyond storage --
                               // interpreted by the frontend (e.g. 1 = Delivered, 2 = Damaged)
        bytes32 dataHash;     // commitment to off-chain evidence (delivery proof/photo/doc CID hash)
        address proposer;
        address[] attestors;  // proposer auto-included as attestors[0]
        uint256 submittedAt;
        uint256 disputeWindowEnd;
        Status status;
        address disputedBy;
        string disputeReason;
    }

    mapping(uint256 => OracleFact) public facts;
    uint256 public nextFactId;

    event FactSubmitted(uint256 indexed factId, uint256 indexed tokenId, uint8 factType, bytes32 dataHash, address proposer);
    event FactCoSigned(uint256 indexed factId, address signer, uint256 signatureCount);
    event FactReadyForFinalization(uint256 indexed factId, uint256 disputeWindowEnd);
    event FactDisputed(uint256 indexed factId, address indexed disputedBy, string reason);
    event FactDisputeResolved(uint256 indexed factId, bool proceeded);
    event FactFinalized(uint256 indexed factId, uint256 indexed tokenId, uint8 factType);
    event FactRejected(uint256 indexed factId);

    error InvalidStatus();
    error DuplicateSigner();
    error DisputeWindowActive();
    error DisputeWindowClosed();
    error NotDisputed();

    constructor(address accessControlAddr, address assetRegistryAddr) {
        accessControl = TimeBoundAccessControl(accessControlAddr);
        assetRegistry = AssetRegistry(assetRegistryAddr);
    }

    modifier onlyOracleAttestor() {
        require(accessControl.hasRole(accessControl.ORACLE_ATTESTOR_ROLE(), msg.sender), "not ORACLE_ATTESTOR_ROLE");
        _;
    }

    modifier onlyAuditor() {
        require(accessControl.hasRole(accessControl.AUDITOR_ROLE(), msg.sender), "not AUDITOR_ROLE");
        _;
    }

    modifier onlySuperAdmin() {
        require(accessControl.hasRole(accessControl.SUPER_ADMIN_ROLE(), msg.sender), "not SUPER_ADMIN_ROLE");
        _;
    }

    /// @dev Same staticcall pattern as AssetRegistry._accessControlPaused -- GovernanceTimelock
    ///      itself doesn't check paused() (a pre-existing inconsistency in this codebase, not
    ///      introduced here), but this contract writes into AssetRegistry, so it mirrors
    ///      AssetRegistry's own more defensive pattern instead.
    modifier whenNotPaused() {
        require(!_accessControlPaused(), "OracleAttestation: platform paused");
        _;
    }

    function _accessControlPaused() internal view returns (bool) {
        (bool ok, bytes memory data) = address(accessControl).staticcall(abi.encodeWithSignature("paused()"));
        return ok && abi.decode(data, (bool));
    }

    /// @notice Step 1 -- an independent oracle attestor proposes a real-world fact about a specific
    ///         already-minted asset. Auto-signs as the first attestor.
    function submitFact(uint256 tokenId, uint8 factType, bytes32 dataHash)
        external
        whenNotPaused
        onlyOracleAttestor
        returns (uint256 factId)
    {
        assetRegistry.ownerOf(tokenId); // reverts (ERC721NonexistentToken) if tokenId doesn't exist
        factId = nextFactId++;
        OracleFact storage f = facts[factId];
        f.tokenId = tokenId;
        f.factType = factType;
        f.dataHash = dataHash;
        f.proposer = msg.sender;
        f.attestors.push(msg.sender);
        f.submittedAt = block.timestamp;
        f.status = Status.Submitted;
        emit FactSubmitted(factId, tokenId, factType, dataHash, msg.sender);
    }

    /// @notice Step 2 -- a second, distinct ORACLE_ATTESTOR_ROLE address independently confirms the
    ///         same fact. Once ATTESTATION_THRESHOLD is met, the fact enters its dispute window
    ///         rather than finalizing immediately -- this is the exact gap-analysis §2.2.5
    ///         requirement (multiple independent attestors AND a dispute window before finality).
    function attestFact(uint256 factId) external whenNotPaused onlyOracleAttestor {
        OracleFact storage f = facts[factId];
        if (f.status != Status.Submitted) revert InvalidStatus();
        for (uint256 i = 0; i < f.attestors.length; i++) {
            if (f.attestors[i] == msg.sender) revert DuplicateSigner();
        }
        f.attestors.push(msg.sender);
        emit FactCoSigned(factId, msg.sender, f.attestors.length);

        if (f.attestors.length >= ATTESTATION_THRESHOLD) {
            f.status = Status.Attested;
            f.disputeWindowEnd = block.timestamp + DISPUTE_WINDOW;
            emit FactReadyForFinalization(factId, f.disputeWindowEnd);
        }
    }

    /// @notice Any Auditor can freeze an attested-but-not-yet-final fact during its dispute window
    ///         -- same mechanism/precedent as GovernanceTimelock.raiseDispute.
    function raiseDispute(uint256 factId, string calldata reason) external whenNotPaused onlyAuditor {
        OracleFact storage f = facts[factId];
        if (f.status != Status.Attested) revert InvalidStatus();
        if (block.timestamp >= f.disputeWindowEnd) revert DisputeWindowClosed();
        f.status = Status.Disputed;
        f.disputedBy = msg.sender;
        f.disputeReason = reason;
        emit FactDisputed(factId, msg.sender, reason);
    }

    /// @notice Super Admin multisig adjudicates a disputed fact -- proceed (finalize immediately)
    ///         or reject permanently. Same precedent as GovernanceTimelock.resolveDispute.
    function resolveDispute(uint256 factId, bool proceed) external whenNotPaused onlySuperAdmin {
        OracleFact storage f = facts[factId];
        if (f.status != Status.Disputed) revert NotDisputed();
        emit FactDisputeResolved(factId, proceed);
        if (proceed) {
            _finalize(factId);
        } else {
            f.status = Status.Rejected;
            emit FactRejected(factId);
        }
    }

    /// @notice Permissionless finalization once the dispute window has elapsed with no dispute
    ///         raised -- same "anyone, after the window, if not disputed" shape as
    ///         GovernanceTimelock.executeTransaction.
    function finalize(uint256 factId) external whenNotPaused {
        OracleFact storage f = facts[factId];
        if (f.status != Status.Attested) revert InvalidStatus();
        if (block.timestamp < f.disputeWindowEnd) revert DisputeWindowActive();
        _finalize(factId);
    }

    function _finalize(uint256 factId) internal {
        OracleFact storage f = facts[factId];
        f.status = Status.Finalized;
        assetRegistry.recordOracleFact(f.tokenId, f.factType, f.dataHash, factId);
        emit FactFinalized(factId, f.tokenId, f.factType);
    }

    /// @notice facts(factId)'s auto-generated getter drops the dynamic `attestors` array member
    ///         (a Solidity limitation) -- exposed explicitly here.
    function getAttestors(uint256 factId) external view returns (address[] memory) {
        return facts[factId].attestors;
    }
}
