// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

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
    address public owner;

    event DIDCreated(bytes32 indexed did, address indexed controller, string keyType, uint256 timestamp);
    event KeyRotated(bytes32 indexed did, address indexed newController, string keyType, uint256 timestamp);

    error DIDAlreadyExists();
    error DIDNotFound();
    error NotController();
    error NotAuthorized();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setGuardianRecoveryContract(address recovery) external onlyOwner {
        guardianRecoveryContract = recovery;
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
    function rotateKey(bytes32 did, bytes calldata newPubKey, string calldata keyType) external {
        DIDDocument storage doc = _documents[did];
        if (!doc.exists) revert DIDNotFound();
        if (doc.controller != msg.sender) revert NotController();

        doc.pubKey = newPubKey;
        doc.keyType = keyType;
        emit KeyRotated(did, msg.sender, keyType, block.timestamp);
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
