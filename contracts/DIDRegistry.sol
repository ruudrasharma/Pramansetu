// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISignatureVerifier} from "./interfaces/ISignatureVerifier.sol";
import {TimeBoundAccessControl} from "./TimeBoundAccessControl.sol";

/// @title DIDRegistry
/// @notice W3C-style DID registry. Replaces the centralized identity database entirely (PS 26125,
///         stated problem #1). A DID's authority rests on a registered public key of a given
///         `keyType` — the keyType field is what makes post-quantum migration possible later
///         without a schema change (docs/SECURITY.md §6).
contract DIDRegistry {
    struct DIDDocument {
        address controller;      // address derived from the current public key
        string keyType;          // "ES256K" today; "DILITHIUM3" future
        bytes pubKey;
        string metadataURI;
        uint256 createdAt;
        bool exists;
    }

    mapping(bytes32 => DIDDocument) private _documents;
    mapping(address => bytes32) public didOf;          // reverse lookup: controller -> DID
    address public guardianRecoveryContract;            // only this contract may force-rotate a key
    /// @notice Owner-equivalent authority for setSignatureVerifier/setGuardianRecoveryContract now
    ///         routes through this contract's own 2-of-N SUPER_ADMIN_ROLE propose/co-sign flow
    ///         (proposePlatformAction(5|6,...)/coSignPlatformAction) instead of a single bare
    ///         `owner` address (audit §2.3, TODO.md §3.2) — replaces the previous
    ///         `address public immutable owner`.
    TimeBoundAccessControl public immutable accessControl;
    /// @notice Pluggable signature verifier — swap this address to migrate from ECDSA to Dilithium
    ///         without touching any other contract (SECURITY.md §6, audit item A8).
    ///         Zero address = no on-chain signature verification (acceptable during migration window).
    ISignatureVerifier public signatureVerifier;

    event DIDCreated(bytes32 indexed did, address indexed controller, string keyType, uint256 timestamp);
    event KeyRotated(bytes32 indexed did, address indexed newController, string keyType, uint256 timestamp);
    event SignatureVerifierUpdated(address indexed oldVerifier, address indexed newVerifier);

    error DIDAlreadyExists();
    error DIDNotFound();
    error NotController();
    error NotAuthorized();

    constructor(address accessControlAddr) {
        accessControl = TimeBoundAccessControl(accessControlAddr);
    }

    /// @notice Requires 2-of-N SUPER_ADMIN_ROLE approval via
    ///         accessControl.proposePlatformAction(6, bytes32(0), recovery)/coSignPlatformAction —
    ///         replaces the previous single-signer `onlyOwner` gate.
    function setGuardianRecoveryContract(address recovery) external {
        if (recovery == address(0)) revert("Zero address not allowed");
        if (!accessControl.didGuardianRecoveryAuthorized(recovery)) revert NotAuthorized();
        accessControl.consumeDIDGuardianRecoveryAuthorization(recovery);
        guardianRecoveryContract = recovery;
    }

    /// @notice Swap in a new signature verifier (e.g., ECDSASignatureVerifier → DilithiumVerifier).
    ///         This is the only function that needs to be called for a full post-quantum migration.
    ///         Emits an auditable event so BEL security ops can track the changeover. Requires 2-of-N
    ///         SUPER_ADMIN_ROLE approval via accessControl.proposePlatformAction(5, bytes32(0),
    ///         verifier)/coSignPlatformAction — replaces the previous single-signer `onlyOwner` gate;
    ///         a post-quantum migration is exactly the kind of high-consequence action that shouldn't
    ///         depend on one key (audit §2.3).
    function setSignatureVerifier(address verifier) external {
        if (verifier == address(0)) revert("Zero address not allowed");
        if (!accessControl.didSignatureVerifierAuthorized(verifier)) revert NotAuthorized();
        accessControl.consumeDIDSignatureVerifierAuthorization(verifier);
        address old = address(signatureVerifier);
        signatureVerifier = ISignatureVerifier(verifier);
        emit SignatureVerifierUpdated(old, verifier);
    }

    /// @notice Registers a brand-new DID. Called once at onboarding (docs/USER_FLOWS.md §1).
    function createDID(bytes calldata pubKey, string calldata metadataURI)
        external
        returns (bytes32 did)
    {
        did = keccak256(abi.encodePacked(msg.sender, block.timestamp, pubKey));
        if (_documents[did].exists) revert DIDAlreadyExists();

        _documents[did] = DIDDocument({
            controller: msg.sender,
            keyType: "ES256K",
            pubKey: pubKey,
            metadataURI: metadataURI,
            createdAt: block.timestamp,
            exists: true
        });
        didOf[msg.sender] = did;

        emit DIDCreated(did, msg.sender, "ES256K", block.timestamp);
    }

    function resolveDID(bytes32 did) external view returns (DIDDocument memory) {
        if (!_documents[did].exists) revert DIDNotFound();
        return _documents[did];
    }

    /// @notice Self-service key rotation (controller still has access to their old key).
    ///         If a signatureVerifier is configured, the caller must supply a signature over
    ///         keccak256(did || newPubKey || block.chainid) proving they hold the new private key.
    ///         This prevents "just send any bytes as newPubKey" key stuffing attacks.
    function rotateKey(
        bytes32 did,
        bytes calldata newPubKey,
        string calldata keyType,
        bytes calldata proof
    ) external {
        DIDDocument storage doc = _documents[did];
        if (!doc.exists) revert DIDNotFound();
        if (doc.controller != msg.sender) revert NotController();

        // Crypto-agility: if a verifier is configured, validate the caller's ownership of newPubKey.
        if (address(signatureVerifier) != address(0)) {
            bytes32 message = keccak256(abi.encodePacked(did, newPubKey, block.chainid));
            require(
                signatureVerifier.verify(message, proof, newPubKey, keyType),
                "DIDRegistry: invalid proof of new key ownership"
            );
        }

        address newController = address(uint160(uint256(keccak256(newPubKey))));
        delete didOf[doc.controller];
        doc.controller = newController;
        doc.pubKey = newPubKey;
        doc.keyType = keyType;
        didOf[newController] = did;

        emit KeyRotated(did, newController, keyType, block.timestamp);
    }

    /// @notice Forced rotation path used exclusively by GuardianRecovery once an M-of-N guardian
    ///         threshold + timelock has been satisfied for a lost key (docs/USER_FLOWS.md §5).
    function forceRotateKey(bytes32 did, address newController, bytes calldata newPubKey) external {
        if (msg.sender != guardianRecoveryContract) revert NotAuthorized();
        DIDDocument storage doc = _documents[did];
        if (!doc.exists) revert DIDNotFound();

        delete didOf[doc.controller];
        doc.controller = newController;
        doc.pubKey = newPubKey;
        didOf[newController] = did;

        emit KeyRotated(did, newController, doc.keyType, block.timestamp);
    }
}
