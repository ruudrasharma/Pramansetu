// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TimeBoundAccessControl} from "./TimeBoundAccessControl.sol";

/// @title GovernanceTimelock
/// @notice M5 — answers "who watches the Admin" (docs/SECURITY.md §5.2). No single Super Admin key
///         can unilaterally perform a high-value action: actions queue here, become executable only
///         after a cooling-off window, and any Auditor can raise a dispute during that window to
///         freeze execution pending Super Admin review. Even a legitimately-signed-but-fraudulent
///         transaction is reversible before finalization, immutable after.
contract GovernanceTimelock {
    TimeBoundAccessControl public immutable accessControl;
    uint256 public constant MIN_DELAY = 24 hours;
    uint256 public constant MAX_DELAY = 48 hours;

    enum Status { Queued, Executed, Disputed, Cancelled }

    struct QueuedTx {
        address target;
        bytes data;
        uint256 eta;
        Status status;
        address raisedBy;
        string disputeReason;
    }

    /// @notice 2-of-N SUPER_ADMIN_ROLE staging for queueTransaction (audit §2.5, TODO.md §3.3) —
    ///         replaces the previous single-signer `onlySuperAdmin` gate directly on
    ///         queueTransaction, which the docstring already (aspirationally, not actually)
    ///         described as multisig-gated. `data` is arbitrary-length calldata, so this can't
    ///         reuse TimeBoundAccessControl's fixed-shape PendingAction (role/account only, no
    ///         bytes field) the way 3.1/3.2 did — it needs its own staging struct, mirroring the
    ///         same propose/co-sign idiom (proposer auto-signs, DuplicateSigner/AlreadyExecuted
    ///         checks, ACTION_THRESHOLD-equivalent) TimeBoundAccessControl already established,
    ///         scoped to the contract that actually owns this data.
    struct PendingQueue {
        address target;
        bytes data;
        uint256 delay;
        address proposer;
        address[] signers;
        bool executed;
    }

    uint8 public constant QUEUE_THRESHOLD = 2;

    mapping(uint256 => QueuedTx) public queue;
    mapping(uint256 => PendingQueue) public pendingQueues;
    uint256 public nextTxId;
    uint256 public nextPendingQueueId;

    event QueueProposed(uint256 indexed pendingId, address target, uint256 delay, address proposer);
    event QueueCoSigned(uint256 indexed pendingId, address signer, uint256 signatureCount);
    event TransactionQueued(uint256 indexed txId, address target, uint256 eta);
    event TransactionExecuted(uint256 indexed txId);
    event DisputeRaised(uint256 indexed txId, address indexed raisedBy, string reason);
    event DisputeResolved(uint256 indexed txId, bool proceeded);

    error DelayOutOfRange();
    error NotYetExecutable();
    error AlreadyFinalized();
    error TransactionDisputed();
    error ExecutionFailed();
    error NotDisputed();
    error DuplicateSigner();
    error PendingAlreadyExecuted();

    constructor(address accessControlAddr) {
        accessControl = TimeBoundAccessControl(accessControlAddr);
    }

    modifier onlySuperAdmin() {
        require(accessControl.hasRole(accessControl.SUPER_ADMIN_ROLE(), msg.sender), "not SUPER_ADMIN_ROLE");
        _;
    }

    modifier onlyAuditor() {
        require(accessControl.hasRole(accessControl.AUDITOR_ROLE(), msg.sender), "not AUDITOR_ROLE");
        _;
    }

    /// @notice Step 1: propose queuing a high-value action (e.g. large asset transfer, contract
    ///         upgrade) behind a cooling-off window. Requires a second SUPER_ADMIN to co-sign
    ///         (coSignQueueTransaction, QUEUE_THRESHOLD) before it actually enters `queue` — real
    ///         multisig now, not just a docstring claim (audit §2.5, TODO.md §3.3).
    function proposeQueueTransaction(address target, bytes calldata data, uint256 delay)
        external
        onlySuperAdmin
        returns (uint256 pendingId)
    {
        if (delay < MIN_DELAY || delay > MAX_DELAY) revert DelayOutOfRange();
        pendingId = nextPendingQueueId++;
        PendingQueue storage p = pendingQueues[pendingId];
        p.target = target;
        p.data = data;
        p.delay = delay;
        p.proposer = msg.sender;
        p.signers.push(msg.sender);
        emit QueueProposed(pendingId, target, delay, msg.sender);
    }

    /// @notice Step 2: co-sign a pending queue proposal. Enters the real `queue` (and becomes
    ///         subject to `eta`/dispute/execute exactly as before) automatically once
    ///         QUEUE_THRESHOLD distinct SUPER_ADMINs have signed.
    function coSignQueueTransaction(uint256 pendingId)
        external
        onlySuperAdmin
        returns (uint256 txId)
    {
        PendingQueue storage p = pendingQueues[pendingId];
        if (p.executed) revert PendingAlreadyExecuted();
        for (uint256 i = 0; i < p.signers.length; i++) {
            if (p.signers[i] == msg.sender) revert DuplicateSigner();
        }
        p.signers.push(msg.sender);
        emit QueueCoSigned(pendingId, msg.sender, p.signers.length);

        if (p.signers.length >= QUEUE_THRESHOLD) {
            p.executed = true;
            txId = nextTxId++;
            uint256 eta = block.timestamp + p.delay;
            queue[txId] = QueuedTx({
                target: p.target,
                data: p.data,
                eta: eta,
                status: Status.Queued,
                raisedBy: address(0),
                disputeReason: ""
            });
            emit TransactionQueued(txId, p.target, eta);
        }
    }

    /// @notice Any Auditor-role DID can freeze a queued action during its cooling-off window —
    ///         this is the dispute-resolution mechanism the base RBAC/NFT design otherwise lacks
    ///         (docs/SECURITY.md §5.2).
    function raiseDispute(uint256 txId, string calldata reason) external onlyAuditor {
        QueuedTx storage q = queue[txId];
        if (q.status != Status.Queued) revert AlreadyFinalized();
        q.status = Status.Disputed;
        q.raisedBy = msg.sender;
        q.disputeReason = reason;
        emit DisputeRaised(txId, msg.sender, reason);
    }

    /// @notice Super Admin multisig resolves a dispute: either let it proceed or cancel outright.
    function resolveDispute(uint256 txId, bool proceed) external onlySuperAdmin {
        QueuedTx storage q = queue[txId];
        if (q.status != Status.Disputed) revert NotDisputed();
        q.status = proceed ? Status.Queued : Status.Cancelled;
        emit DisputeResolved(txId, proceed);
    }

    /// @notice Executes a queued transaction once `eta` has passed. Reverts if a dispute is active,
    ///         even if `eta` has already elapsed — dispute status is checked independently of time.
    function executeTransaction(uint256 txId) external {
        QueuedTx storage q = queue[txId];
        if (q.status == Status.Disputed) revert TransactionDisputed();
        if (q.status != Status.Queued) revert AlreadyFinalized();
        if (block.timestamp < q.eta) revert NotYetExecutable();

        q.status = Status.Executed;
        emit TransactionExecuted(txId);

        (bool ok, ) = q.target.call(q.data);
        if (!ok) revert ExecutionFailed();
    }
}
