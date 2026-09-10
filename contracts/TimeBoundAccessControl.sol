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
    /// @notice Added post-launch via UUPS upgrade (T-016, gap analysis §2.2.5) -- independent
    ///         oracle attestors for OracleAttestation.sol's multi-attestor + dispute-window fact
    ///         mechanism. Its role-admin is set by initializeOracleAttestorRole()'s reinitializer
    ///         below, not by initialize(), since initialize() already ran on the live deployment
    ///         before this role existed.
    bytes32 public constant ORACLE_ATTESTOR_ROLE = keccak256("ORACLE_ATTESTOR_ROLE");

    uint8 public constant GRANT_THRESHOLD = 2;   // 2-of-N co-signature for privileged grants
    uint8 public constant ACTION_THRESHOLD = 2;  // 2-of-N co-signature for emergencyRevoke/pause

    struct PendingGrant {
        bytes32 role;
        address account;
        uint256 validUntil;
        address proposer;
        address[] signers;
        bool executed;
    }

    /// @dev Generic pending action used for emergencyRevoke, pause, unpause, authorizeUpgrade, and
    ///      DIDRegistry's owner-equivalent actions.
    ///      actionType: 1 = emergencyRevoke, 2 = pause, 3 = unpause, 4 = authorizeUpgrade,
    ///                  5 = authorizeDIDSignatureVerifier, 6 = authorizeDIDGuardianRecovery,
    ///                  7 = authorizeOracleAttestationContract
    struct PendingAction {
        uint8 actionType;
        bytes32 role;       // used by emergencyRevoke
        address account;    // used by emergencyRevoke; holds the pending target address for
                             // actionType == 4/5/6 — same field, no new slot
        address proposer;
        address[] signers;
        bool executed;
    }

    mapping(bytes32 role => mapping(address account => uint256 expiry)) public roleExpiry;
    mapping(uint256 => PendingGrant) public pendingGrants;
    mapping(uint256 => PendingAction) public pendingActions;
    uint256 public nextGrantId;
    uint256 public nextActionId;
    /// @notice Set true once a 2-of-N SUPER_ADMIN_ROLE-approved actionType==4 (authorizeUpgrade)
    ///         PendingAction reaches threshold for this exact implementation address — checked (and
    ///         consumed) by _authorizeUpgrade below. Appended after the existing state variables so
    ///         the upgrade that introduces it stays storage-layout-safe (TODO.md §3.1).
    mapping(address => bool) public upgradeAuthorized;
    /// @notice Same pattern as upgradeAuthorized, for DIDRegistry's owner-equivalent actions
    ///         (audit §2.3, TODO.md §3.2) — DIDRegistry has no upgrade proxy of its own, but its
    ///         setSignatureVerifier/setGuardianRecoveryContract functions delegate their
    ///         authorization check here instead of a bare `onlyOwner`. Also append-only.
    mapping(address => bool) public didSignatureVerifierAuthorized;
    mapping(address => bool) public didGuardianRecoveryAuthorized;
    /// @notice Same pattern, for AssetRegistry.setOracleAttestationContract (T-016, gap analysis
    ///         §2.2.5). Also append-only.
    mapping(address => bool) public oracleAttestationAuthorized;

    event TimedRoleGranted(bytes32 indexed role, address indexed account, uint256 validUntil);
    event GrantProposed(uint256 indexed grantId, bytes32 role, address account, address proposer);
    event GrantCoSigned(uint256 indexed grantId, address signer, uint256 signatureCount);
    event EmergencyRevoked(bytes32 indexed role, address indexed account, address indexed revokedBy);
    event ActionProposed(uint256 indexed actionId, uint8 actionType, address proposer);
    event ActionCoSigned(uint256 indexed actionId, address signer, uint256 signatureCount);
    event ActionExecuted(uint256 indexed actionId, uint8 actionType);

    error ValidityInPast();
    error AlreadyExecuted();
    error DuplicateSigner();
    error ThresholdNotMet();
    error OnlyDistinctSigner();
    error InvalidActionType();
    error UpgradeNotAuthorized();

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

    /// @notice Step 1: Propose an emergencyRevoke, pause, unpause, authorizeUpgrade, or
    ///         DIDRegistry/AssetRegistry owner-equivalent action. Requires a second SUPER_ADMIN to
    ///         co-sign (ACTION_THRESHOLD) before execution.
    ///         actionType: 1 = emergencyRevoke, 2 = pause, 3 = unpause, 4 = authorizeUpgrade,
    ///                     5 = authorizeDIDSignatureVerifier, 6 = authorizeDIDGuardianRecovery,
    ///                     7 = authorizeOracleAttestationContract
    ///         (for actionType 4/5/6/7, pass the pending target address as `account`; `role` is
    ///         unused, pass bytes32(0))
    function proposePlatformAction(
        uint8 actionType,
        bytes32 role,
        address account
    ) external onlyRole(SUPER_ADMIN_ROLE) returns (uint256 actionId) {
        if (actionType < 1 || actionType > 7) revert InvalidActionType();
        actionId = nextActionId++;
        PendingAction storage a = pendingActions[actionId];
        a.actionType = actionType;
        a.role = role;
        a.account = account;
        a.proposer = msg.sender;
        a.signers.push(msg.sender);
        emit ActionProposed(actionId, actionType, msg.sender);
    }

    /// @notice Step 2: Co-sign a pending platform action. Executes automatically once threshold met.
    function coSignPlatformAction(uint256 actionId) external onlyRole(SUPER_ADMIN_ROLE) {
        PendingAction storage a = pendingActions[actionId];
        if (a.executed) revert AlreadyExecuted();
        for (uint256 i = 0; i < a.signers.length; i++) {
            if (a.signers[i] == msg.sender) revert DuplicateSigner();
        }
        a.signers.push(msg.sender);
        emit ActionCoSigned(actionId, msg.sender, a.signers.length);

        if (a.signers.length >= ACTION_THRESHOLD) {
            a.executed = true;
            emit ActionExecuted(actionId, a.actionType);
            if (a.actionType == 1) {
                roleExpiry[a.role][a.account] = block.timestamp;
                emit EmergencyRevoked(a.role, a.account, msg.sender);
            } else if (a.actionType == 2) {
                _pause();
            } else if (a.actionType == 3) {
                _unpause();
            } else if (a.actionType == 4) {
                upgradeAuthorized[a.account] = true;
            } else if (a.actionType == 5) {
                didSignatureVerifierAuthorized[a.account] = true;
            } else if (a.actionType == 6) {
                didGuardianRecoveryAuthorized[a.account] = true;
            } else if (a.actionType == 7) {
                oracleAttestationAuthorized[a.account] = true;
            }
        }
    }

    /// @notice Replaces the previous single-signer `onlyRole(SUPER_ADMIN_ROLE)` gate (audit §2.2) —
    ///         an upgrade now requires the same 2-of-N SUPER_ADMIN_ROLE co-signature as every other
    ///         privileged action, via proposePlatformAction(4, ...)/coSignPlatformAction, rather than
    ///         a parallel mechanism. The approval is consumed on use (one authorization, one upgrade)
    ///         rather than left standing indefinitely — see consumeUpgradeAuthorization's note on why
    ///         that matters.
    function _authorizeUpgrade(address newImplementation) internal override {
        if (!upgradeAuthorized[newImplementation]) revert UpgradeNotAuthorized();
        upgradeAuthorized[newImplementation] = false;
    }

    /// @notice Lets another UUPS contract that delegates its own upgrade authorization to this
    ///         contract's 2-of-N approval (see AssetRegistry._authorizeUpgrade) consume its
    ///         approval on use. Intentionally permissionless rather than restricted to a registered
    ///         caller — restricting it would mean either a new trusted-address registry (its own
    ///         single-point-of-trust setter) or a reverse dependency from this contract onto
    ///         AssetRegistry, both disproportionate to what this fixes. The tradeoff: anyone can
    ///         grief a pending approval by consuming it before the real upgrade call lands, forcing
    ///         a re-propose+re-co-sign — a denial-of-service nuisance, not a privilege escalation
    ///         (no unauthorized upgrade can ever succeed this way). Not consuming at all would be
    ///         worse: without this, an old, since-superseded implementation address would stay
    ///         permanently "authorized," letting anyone call the proxy's public `upgradeToAndCall`
    ///         to silently revert AssetRegistry to old (possibly vulnerable) code with no fresh
    ///         approval — a real downgrade-replay hole, not just a nuisance.
    function consumeUpgradeAuthorization(address newImplementation) external {
        upgradeAuthorized[newImplementation] = false;
    }

    /// @notice Same pattern and same documented permissionless-consumption tradeoff as
    ///         consumeUpgradeAuthorization above, for DIDRegistry.setSignatureVerifier/
    ///         setGuardianRecoveryContract (audit §2.3, TODO.md §3.2).
    function consumeDIDSignatureVerifierAuthorization(address verifier) external {
        didSignatureVerifierAuthorized[verifier] = false;
    }

    function consumeDIDGuardianRecoveryAuthorization(address recovery) external {
        didGuardianRecoveryAuthorized[recovery] = false;
    }

    /// @notice Same pattern, for AssetRegistry.setOracleAttestationContract (T-016).
    function consumeOracleAttestationAuthorization(address oracleAttestation) external {
        oracleAttestationAuthorized[oracleAttestation] = false;
    }

    /// @notice One-time post-upgrade setup introducing ORACLE_ATTESTOR_ROLE (T-016). Uses OZ's
    ///         reinitializer(2) because initialize() above already permanently consumed version 1
    ///         (Initializable.initializer is reinitializer(1)) on the live deployment, before this
    ///         role existed -- the standard OZ pattern for "an upgrade adds a module that needs its
    ///         own one-time setup." Intended to be passed as the `data` argument to the proxy's own
    ///         upgradeToAndCall(newImpl, data), not called as a separate follow-up transaction --
    ///         atomic with the upgrade itself means there is no window where the implementation is
    ///         swapped but ORACLE_ATTESTOR_ROLE's admin is still unset, and a failed reinitializer
    ///         reverts the entire upgrade transaction (no partial-upgrade state), matching the
    ///         "nothing manual left in between" discipline the T-017/T-018 incident note already
    ///         established for this project's deploy scripts.
    ///         Gated onlyRole(SUPER_ADMIN_ROLE): msg.sender during the delegatecall this runs under
    ///         is whoever called upgradeToAndCall on the proxy -- UUPSUpgradeable's own
    ///         upgradeToAndCall has no caller restriction of its own (see _authorizeUpgrade above),
    ///         so this check is what stops an arbitrary caller from being the one who "executes"
    ///         the already-authorized upgrade+init step.
    function initializeOracleAttestorRole() public reinitializer(2) onlyRole(SUPER_ADMIN_ROLE) {
        _setRoleAdmin(ORACLE_ATTESTOR_ROLE, SUPER_ADMIN_ROLE);
    }
}
