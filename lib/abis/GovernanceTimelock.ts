/**
 * GovernanceTimelock ABI — auto-sourced from Hardhat compilation artifact.
 * Do not hand-edit; re-run: npm run compile:contracts
 */
export const GovernanceTimelockAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "accessControlAddr",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "AlreadyFinalized",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "DelayOutOfRange",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ExecutionFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotDisputed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotYetExecutable",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TransactionDisputed",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "txId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "raisedBy",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "reason",
        "type": "string"
      }
    ],
    "name": "DisputeRaised",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "txId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "proceeded",
        "type": "bool"
      }
    ],
    "name": "DisputeResolved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "txId",
        "type": "uint256"
      }
    ],
    "name": "TransactionExecuted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "txId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "target",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "eta",
        "type": "uint256"
      }
    ],
    "name": "TransactionQueued",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "MAX_DELAY",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MIN_DELAY",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "accessControl",
    "outputs": [
      {
        "internalType": "contract TimeBoundAccessControl",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "txId",
        "type": "uint256"
      }
    ],
    "name": "executeTransaction",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextTxId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "queue",
    "outputs": [
      {
        "internalType": "address",
        "name": "target",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      },
      {
        "internalType": "uint256",
        "name": "eta",
        "type": "uint256"
      },
      {
        "internalType": "enum GovernanceTimelock.Status",
        "name": "status",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "raisedBy",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "disputeReason",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "target",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      },
      {
        "internalType": "uint256",
        "name": "delay",
        "type": "uint256"
      }
    ],
    "name": "queueTransaction",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "txId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "txId",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "reason",
        "type": "string"
      }
    ],
    "name": "raiseDispute",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "txId",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "proceed",
        "type": "bool"
      }
    ],
    "name": "resolveDispute",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
