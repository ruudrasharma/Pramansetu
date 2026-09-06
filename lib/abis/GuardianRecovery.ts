/**
 * GuardianRecovery ABI — auto-sourced from Hardhat compilation artifact.
 * Do not hand-edit; re-run: npm run compile:contracts
 */
export const GuardianRecoveryAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "didRegistryAddr",
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
    "name": "DuplicateSignature",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidGuardianCount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidThreshold",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NoActiveRecovery",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotAGuardian",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotController",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ThresholdNotMet",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TimelockNotElapsed",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "did",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "address[]",
        "name": "guardians",
        "type": "address[]"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "threshold",
        "type": "uint8"
      }
    ],
    "name": "GuardiansRegistered",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "did",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "newController",
        "type": "address"
      }
    ],
    "name": "RecoveryFinalized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "did",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "newController",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "initiatedBy",
        "type": "address"
      }
    ],
    "name": "RecoveryInitiated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "did",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "guardian",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "signatureCount",
        "type": "uint256"
      }
    ],
    "name": "RecoverySigned",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "MAX_GUARDIANS",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MIN_GUARDIANS",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "RECOVERY_TIMELOCK",
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
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "activeRecovery",
    "outputs": [
      {
        "internalType": "address",
        "name": "newController",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "newPubKey",
        "type": "bytes"
      },
      {
        "internalType": "uint256",
        "name": "initiatedAt",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "finalized",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "didRegistry",
    "outputs": [
      {
        "internalType": "contract DIDRegistry",
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
        "internalType": "bytes32",
        "name": "did",
        "type": "bytes32"
      }
    ],
    "name": "finalizeRecovery",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "guardiansOf",
    "outputs": [
      {
        "internalType": "address",
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
        "internalType": "bytes32",
        "name": "did",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "newController",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "newPubKey",
        "type": "bytes"
      }
    ],
    "name": "initiateRecovery",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "recoveryThreshold",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "did",
        "type": "bytes32"
      },
      {
        "internalType": "address[]",
        "name": "guardians",
        "type": "address[]"
      },
      {
        "internalType": "uint8",
        "name": "threshold",
        "type": "uint8"
      }
    ],
    "name": "registerGuardians",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "did",
        "type": "bytes32"
      }
    ],
    "name": "signRecovery",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
