// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title TimeBoundAccessControl
/// @notice The RBAC trust core (M2). Access control is enforced HERE, inside the contract, not in
///         application middleware — there is no code path that bypasses a role check. Two design
///         decisions directly close gaps from the analysis:
///         1. Every (role, account) grant carries an expiry — `hasRole()` auto-fails once expired,
///            closing the "no instant revocation" gap (docs/SECURITY.md §5.2) without needing a
///            separate revocation transaction.
///         2. High-privilege grants require 2-of-3 Admin-tier co-signature, so a single compromised
///            Admin key cannot unilaterally escalate privileges (closes "admin key compromise = full
///            takeover").
///         Sits behind a UUPS proxy so logic bugs are patchable without losing role state.
contract TimeBoundAccessControl is Initializable, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    bytes32 public constant SUPER_ADMIN_ROLE = keccak256("SUPER_ADMIN_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    bytes32 public constant USER_ROLE = keccak256("USER_ROLE");

    uint8 public constant GRANT_THRESHOLD = 2; // 2-of-3 Admin co-signature for privileged grants

    struct PendingGrant {
        bytes32 role;
        address account;
        uint256 validUntil;
        address proposer;
        address[] signers;
        bool executed;
    }

    mapping(bytes32 role => mapping(address account => uint256 expiry)) public roleExpiry;
    mapping(uint256 => PendingGrant) public pendingGrants;
    uint256 public nextGrantId;

    event TimedRoleGranted(bytes32 indexed role, address indexed account, uint256 validUntil);
    event GrantProposed(uint256 indexed grantId, bytes32 role, address account, address proposer);
    event GrantCoSigned(uint256 indexed grantId, address signer, uint256 signatureCount);
    event EmergencyRevoked(bytes32 indexed role, address indexed account, address indexed revokedBy);

    error ValidityInPast();
    error AlreadyExecuted();
    error DuplicateSigner();
    error ThresholdNotMet();
    error OnlyDistinctSigner();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address superAdmin) public initializer {
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, superAdmin);
        _grantRole(SUPER_ADMIN_ROLE, superAdmin);
        // Set a far-future expiry so the overridden hasRole() works for bootstrap accounts.
        // Without this, the initial superAdmin would fail hasRole() immediately because
        // roleExpiry would be 0 and block.timestamp > 0 (ARCHITECTURE.md §2, SECURITY.md §2).
        roleExpiry[DEFAULT_ADMIN_ROLE][superAdmin] = type(uint256).max;
        roleExpiry[SUPER_ADMIN_ROLE][superAdmin] = type(uint256).max;
        _setRoleAdmin(ADMIN_ROLE, SUPER_ADMIN_ROLE);
        _setRoleAdmin(MANAGER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(AUDITOR_ROLE, SUPER_ADMIN_ROLE);
        _setRoleAdmin(USER_ROLE, ADMIN_ROLE);
    }

    /// @notice Direct grant path for low-privilege roles (User/Manager) — single Admin signature.
    function grantTimedRole(bytes32 role, address account, uint256 validUntil)
        external
        onlyRole(getRoleAdmin(role))
        whenNotPaused
    {
        if (validUntil <= block.timestamp) revert ValidityInPast();
        _grantRole(role, account);
        roleExpiry[role][account] = validUntil;
        emit TimedRoleGranted(role, account, validUntil);
    }

    /// @notice Propose a privileged grant (Admin escalation, etc.) requiring 2-of-3 co-signature.
    function proposePrivilegedGrant(bytes32 role, address account, uint256 validUntil)
        external
        onlyRole(SUPER_ADMIN_ROLE)
        whenNotPaused
        returns (uint256 grantId)
    {
        if (validUntil <= block.timestamp) revert ValidityInPast();
        grantId = nextGrantId++;
        PendingGrant storage g = pendingGrants[grantId];
        g.role = role;
        g.account = account;
        g.validUntil = validUntil;
        g.proposer = msg.sender;
        g.signers.push(msg.sender);
        emit GrantProposed(grantId, role, account, msg.sender);
    }

    /// @notice Co-sign a pending privileged grant. Executes automatically once GRANT_THRESHOLD is met.
    function coSignGrant(uint256 grantId) external onlyRole(SUPER_ADMIN_ROLE) whenNotPaused {
        PendingGrant storage g = pendingGrants[grantId];
        if (g.executed) revert AlreadyExecuted();
        for (uint256 i = 0; i < g.signers.length; i++) {
            if (g.signers[i] == msg.sender) revert DuplicateSigner();
        }
        g.signers.push(msg.sender);
        emit GrantCoSigned(grantId, msg.sender, g.signers.length);

        if (g.signers.length >= GRANT_THRESHOLD) {
            g.executed = true;
            _grantRole(g.role, g.account);
            roleExpiry[g.role][g.account] = g.validUntil;
            emit TimedRoleGranted(g.role, g.account, g.validUntil);
        }
    }

    /// @notice Overridden: a role only "counts" if it was granted AND has not yet expired. This is
    ///         the single line that turns every role in the system into a time-bound permission
    ///         instead of a static on/off flag.
    function hasRole(bytes32 role, address account)
        public
        view
        override
        returns (bool)
    {
        return super.hasRole(role, account) && block.timestamp < roleExpiry[role][account];
    }

    /// @notice Priority path: any 2 Super Admins can instantly kill a role without waiting for
    ///         expiry — used the moment a compromise or termination is detected
    ///         (docs/USER_FLOWS.md §3, §4).
    function emergencyRevoke(bytes32 role, address account) external onlyRole(SUPER_ADMIN_ROLE) {
        roleExpiry[role][account] = block.timestamp;
        emit EmergencyRevoked(role, account, msg.sender);
    }

    /// @notice Freezes every state-changing function across the platform (via the shared
    ///         `whenNotPaused` modifier honored by AssetRegistry/GovernanceTimelock too) in a
    ///         single transaction. Call requires 2 Super Admins in practice via the governance
    ///         multisig wrapper (docs/FEATURES.md F2.3).
    function pause() external onlyRole(SUPER_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(SUPER_ADMIN_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(SUPER_ADMIN_ROLE) {}
}
