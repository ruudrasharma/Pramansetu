/**
 * OracleAttestation ABI — auto-sourced from Hardhat compilation artifact.
 * Do not hand-edit; re-run: npm run compile:contracts
 */
export const OracleAttestationAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "accessControlAddr",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "assetRegistryAddr",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "DisputeWindowActive",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "DisputeWindowClosed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "DuplicateSigner",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidStatus",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotDisputed",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "factId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "signer",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "signatureCount",
        "type": "uint256"
      }
    ],
    "name": "FactCoSigned",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "factId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "proceeded",
        "type": "bool"
      }
    ],
    "name": "FactDisputeResolved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "factId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "disputedBy",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "reason",
        "type": "string"
      }
    ],
    "name": "FactDisputed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "factId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "factType",
        "type": "uint8"
      }
    ],
    "name": "FactFinalized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "factId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "disputeWindowEnd",
        "type": "uint256"
      }
    ],
    "name": "FactReadyForFinalization",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "factId",
        "type": "uint256"
      }
    ],
    "name": "FactRejected",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "factId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "factType",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "dataHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "proposer",
        "type": "address"
      }
    ],
    "name": "FactSubmitted",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "ATTESTATION_THRESHOLD",
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
    "name": "DISPUTE_WINDOW",
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
    "inputs": [],
    "name": "assetRegistry",
    "outputs": [
      {
        "internalType": "contract AssetRegistry",
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
        "name": "factId",
        "type": "uint256"
      }
    ],
    "name": "attestFact",
    "outputs": [],
    "stateMutability": "nonpayable",
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
    "name": "facts",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "internalType": "uint8",
        "name": "factType",
        "type": "uint8"
      },
      {
        "internalType": "bytes32",
        "name": "dataHash",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "proposer",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "submittedAt",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "disputeWindowEnd",
        "type": "uint256"
      },
      {
        "internalType": "enum OracleAttestation.Status",
        "name": "status",
        "type": "uint8"
      },
      {
        "internalType": "address",
        "name": "disputedBy",
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
        "internalType": "uint256",
        "name": "factId",
        "type": "uint256"
      }
    ],
    "name": "finalize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "factId",
        "type": "uint256"
      }
    ],
    "name": "getAttestors",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "",
        "type": "address[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextFactId",
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
        "name": "factId",
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
        "name": "factId",
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
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "internalType": "uint8",
        "name": "factType",
        "type": "uint8"
      },
      {
        "internalType": "bytes32",
        "name": "dataHash",
        "type": "bytes32"
      }
    ],
    "name": "submitFact",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "factId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
