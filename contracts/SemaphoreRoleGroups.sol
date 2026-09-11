// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISemaphore} from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";
import {TimeBoundAccessControl} from "./TimeBoundAccessControl.sol";

/// @title SemaphoreRoleGroups
/// @notice M7 — real zero-knowledge proof-of-role (T-015, gap analysis §2.1.4 "Permanent Public
///         Correlation / Privacy Leakage"). A user proves "I hold role X" without revealing which
///         DID/address they are, using the Semaphore protocol's official, audited Sepolia
///         deployment (no custom trusted setup or verifier deployed by this project). This
///         contract is the bridge: one Semaphore group per TimeBoundAccessControl role, kept in
///         sync with live hasRole() state rather than a cached snapshot -- closing
///         docs/FEATURES.md F1.4's flagged edge case ("proof generated against a credential that
///         gets revoked mid-session -- verification must re-check the live Merkle root, not a
///         cached one") for real: removeMemberFromRole actually updates the on-chain Merkle root
///         once a role lapses, rather than just documenting that it should.
///         Non-upgradeable and standalone -- does not modify TimeBoundAccessControl or
///         DIDRegistry, only reads TimeBoundAccessControl.hasRole().
contract SemaphoreRoleGroups {
    TimeBoundAccessControl public immutable accessControl;
    ISemaphore public immutable semaphore;

    mapping(bytes32 => uint256) public groupIdOf; // role => Semaphore groupId
    mapping(address => uint256) public commitmentOf; // account => Semaphore identity commitment
    mapping(bytes32 => mapping(address => bool)) public isMember; // role => account => currently synced

    event CommitmentRegistered(address indexed account, uint256 commitment);
    event MemberSynced(bytes32 indexed role, address indexed account, uint256 commitment);
    event MemberRemovedFromRole(bytes32 indexed role, address indexed account, uint256 commitment);

    error AlreadyRegistered();
    error NotRegistered();
    error RoleStillHeld();
    error RoleNotHeld();
    error NotAMember();

    constructor(address accessControlAddr, address semaphoreAddr) {
        accessControl = TimeBoundAccessControl(accessControlAddr);
        semaphore = ISemaphore(semaphoreAddr);
        groupIdOf[accessControl.SUPER_ADMIN_ROLE()] = semaphore.createGroup(address(this));
        groupIdOf[accessControl.ADMIN_ROLE()] = semaphore.createGroup(address(this));
        groupIdOf[accessControl.MANAGER_ROLE()] = semaphore.createGroup(address(this));
        groupIdOf[accessControl.AUDITOR_ROLE()] = semaphore.createGroup(address(this));
        groupIdOf[accessControl.USER_ROLE()] = semaphore.createGroup(address(this));
    }

    /// @notice One-time, self-service registration of a Semaphore identity commitment. No
    ///         rotation path in this pass -- a lost local identity secret means the associated
    ///         commitment is stuck unusable (same class of limitation as didService.ts's own
    ///         prototype-grade key storage; see docs/SECURITY.md).
    function registerCommitment(uint256 commitment) external {
        if (commitmentOf[msg.sender] != 0) revert AlreadyRegistered();
        commitmentOf[msg.sender] = commitment;
        emit CommitmentRegistered(msg.sender, commitment);
    }

    /// @notice Permissionless, self-correcting: adds `account` to `role`'s Semaphore group iff
    ///         they actually hold the role right now (checked live, not cached) and aren't
    ///         already synced.
    function syncMember(bytes32 role, address account) external {
        if (commitmentOf[account] == 0) revert NotRegistered();
        if (!accessControl.hasRole(role, account)) revert RoleNotHeld();
        if (isMember[role][account]) return;
        uint256 commitment = commitmentOf[account];
        semaphore.addMember(groupIdOf[role], commitment);
        isMember[role][account] = true;
        emit MemberSynced(role, account, commitment);
    }

    /// @notice The removal counterpart -- requires Merkle proof siblings computed off-chain (the
    ///         caller reconstructs the group's current tree from this contract's own
    ///         MemberSynced/MemberRemovedFromRole events, e.g. via the Semaphore group library).
    ///         Permissionless: anyone can trigger cleanup once a role has actually lapsed, same
    ///         "permissionless once conditions are met" idiom as OracleAttestation.finalize /
    ///         TimeBoundAccessControl.consumeUpgradeAuthorization elsewhere in this codebase.
    function removeMemberFromRole(bytes32 role, address account, uint256[] calldata merkleProofSiblings) external {
        if (accessControl.hasRole(role, account)) revert RoleStillHeld();
        if (!isMember[role][account]) revert NotAMember();
        uint256 commitment = commitmentOf[account];
        semaphore.removeMember(groupIdOf[role], commitment, merkleProofSiblings);
        isMember[role][account] = false;
        emit MemberRemovedFromRole(role, account, commitment);
    }
}
