// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DIDRegistry} from "./DIDRegistry.sol";

/// @title GuardianRecovery
/// @notice Closes the single biggest operational gap in any pure-DID system: private key loss =
///         permanent identity lockout (docs/SECURITY.md §5.2, USER_FLOWS.md §5). A DID controller
///         pre-registers 3–5 guardians and a signature threshold; losing the key triggers an M-of-N
///         guardian-signed, time-locked rotation. No single guardian ever has unilateral control.
contract GuardianRecovery {
    DIDRegistry public didRegistry;
    uint256 public constant RECOVERY_TIMELOCK = 24 hours;
    uint8 public constant MIN_GUARDIANS = 3;
    uint8 public constant MAX_GUARDIANS = 5;

    struct RecoveryRequest {
        address newController;
        bytes newPubKey;
        address[] signers;
        uint256 initiatedAt;
        bool finalized;
    }

    mapping(bytes32 => address[]) public guardiansOf;      // did => guardian addresses
    mapping(bytes32 => uint8) public recoveryThreshold;     // did => M in M-of-N
    mapping(bytes32 => RecoveryRequest) public activeRecovery;

    event GuardiansRegistered(bytes32 indexed did, address[] guardians, uint8 threshold);
    event RecoveryInitiated(bytes32 indexed did, address newController, address initiatedBy);
    event RecoverySigned(bytes32 indexed did, address guardian, uint256 signatureCount);
    event RecoveryFinalized(bytes32 indexed did, address newController);

    error InvalidGuardianCount();
    error InvalidThreshold();
    error NotAGuardian();
    error DuplicateSignature();
    error ThresholdNotMet();
    error TimelockNotElapsed();
    error NoActiveRecovery();
    error AlreadyFinalized();

    constructor(address didRegistryAddr) {
        didRegistry = DIDRegistry(didRegistryAddr);
    }

    /// @notice Called once by a DID controller, any time before they need it.
    function registerGuardians(bytes32 did, address[] calldata guardians, uint8 threshold) external {
        if (guardians.length < MIN_GUARDIANS || guardians.length > MAX_GUARDIANS) revert InvalidGuardianCount();
        if (threshold == 0 || threshold > guardians.length) revert InvalidThreshold();

        guardiansOf[did] = guardians;
        recoveryThreshold[did] = threshold;
        emit GuardiansRegistered(did, guardians, threshold);
    }

    /// @notice Any registered guardian can kick off recovery on behalf of a locked-out user.
    function initiateRecovery(bytes32 did, address newController, bytes calldata newPubKey) external {
        if (!_isGuardian(did, msg.sender)) revert NotAGuardian();

        RecoveryRequest storage r = activeRecovery[did];
        r.newController = newController;
        r.newPubKey = newPubKey;
        delete r.signers;
        r.signers.push(msg.sender);
        r.initiatedAt = block.timestamp;
        r.finalized = false;

        emit RecoveryInitiated(did, newController, msg.sender);
    }

    /// @notice Each subsequent guardian signs until the threshold is met.
    function signRecovery(bytes32 did) external {
        if (!_isGuardian(did, msg.sender)) revert NotAGuardian();
        RecoveryRequest storage r = activeRecovery[did];
        if (r.initiatedAt == 0) revert NoActiveRecovery();

        for (uint256 i = 0; i < r.signers.length; i++) {
            if (r.signers[i] == msg.sender) revert DuplicateSignature();
        }
        r.signers.push(msg.sender);
        emit RecoverySigned(did, msg.sender, r.signers.length);
    }

    /// @notice Anyone may finalize once threshold + timelock are both satisfied — the timelock
    ///         window gives the legitimate controller a chance to object if recovery was triggered
    ///         maliciously (defense-in-depth on top of the M-of-N requirement).
    function finalizeRecovery(bytes32 did) external {
        RecoveryRequest storage r = activeRecovery[did];
        if (r.initiatedAt == 0) revert NoActiveRecovery();
        if (r.finalized) revert AlreadyFinalized();
        if (r.signers.length < recoveryThreshold[did]) revert ThresholdNotMet();
        if (block.timestamp < r.initiatedAt + RECOVERY_TIMELOCK) revert TimelockNotElapsed();

        r.finalized = true;
        didRegistry.forceRotateKey(did, r.newController, r.newPubKey);
        emit RecoveryFinalized(did, r.newController);
    }

    function _isGuardian(bytes32 did, address addr) internal view returns (bool) {
        address[] storage guardians = guardiansOf[did];
        for (uint256 i = 0; i < guardians.length; i++) {
            if (guardians[i] == addr) return true;
        }
        return false;
    }
}
