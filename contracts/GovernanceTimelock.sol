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
    TimeBoundAccessControl public accessControl;
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

    mapping(uint256 => QueuedTx) public queue;
    uint256 public nextTxId;

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

    /// @notice Queues a high-value action (e.g. large asset transfer, contract upgrade) behind a
    ///         cooling-off window. Requires Super Admin multisig approval upstream in practice.
    function queueTransaction(address target, bytes calldata data, uint256 delay)
        external
        onlySuperAdmin
        returns (uint256 txId)
    {
        if (delay < MIN_DELAY || delay > MAX_DELAY) revert DelayOutOfRange();
        txId = nextTxId++;
        queue[txId] = QueuedTx({
            target: target,
            data: data,
            eta: block.timestamp + delay,
            status: Status.Queued,
            raisedBy: address(0),
            disputeReason: ""
        });
        emit TransactionQueued(txId, target, block.timestamp + delay);
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
        (bool ok, ) = q.target.call(q.data);
        if (!ok) revert ExecutionFailed();

        emit TransactionExecuted(txId);
    }
}
