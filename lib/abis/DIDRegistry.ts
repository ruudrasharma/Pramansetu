/**
 * DIDRegistry ABI — auto-sourced from Hardhat compilation artifact.
 * Do not hand-edit; re-run: npm run compile:contracts
 */
export const DIDRegistryAbi = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "DIDAlreadyExists",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "DIDNotFound",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotAuthorized",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotController",
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
        "indexed": true,
        "internalType": "address",
        "name": "controller",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "keyType",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "DIDCreated",
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
        "indexed": true,
        "internalType": "address",
        "name": "newController",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "keyType",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "KeyRotated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "oldVerifier",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newVerifier",
        "type": "address"
      }
    ],
    "name": "SignatureVerifierUpdated",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "pubKey",
        "type": "bytes"
      },
      {
        "internalType": "string",
        "name": "metadataURI",
        "type": "string"
      }
    ],
    "name": "createDID",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "did",
        "type": "bytes32"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "didOf",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
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
    "name": "forceRotateKey",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "guardianRecoveryContract",
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
    "inputs": [],
    "name": "owner",
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
      }
    ],
    "name": "resolveDID",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "controller",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "keyType",
            "type": "string"
          },
          {
            "internalType": "bytes",
            "name": "pubKey",
            "type": "bytes"
          },
          {
            "internalType": "string",
            "name": "metadataURI",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "createdAt",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "exists",
            "type": "bool"
          }
        ],
        "internalType": "struct DIDRegistry.DIDDocument",
        "name": "",
        "type": "tuple"
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
        "internalType": "bytes",
        "name": "newPubKey",
        "type": "bytes"
      },
      {
        "internalType": "string",
        "name": "keyType",
        "type": "string"
      },
      {
        "internalType": "bytes",
        "name": "proof",
        "type": "bytes"
      }
    ],
    "name": "rotateKey",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "recovery",
        "type": "address"
      }
    ],
    "name": "setGuardianRecoveryContract",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "verifier",
        "type": "address"
      }
    ],
    "name": "setSignatureVerifier",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "signatureVerifier",
    "outputs": [
      {
        "internalType": "contract ISignatureVerifier",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
