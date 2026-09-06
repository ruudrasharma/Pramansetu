// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ISignatureVerifier} from "./interfaces/ISignatureVerifier.sol";

/// @title ECDSASignatureVerifier
/// @notice Today's implementation of ISignatureVerifier — secp256k1 / ECDSA only. This contract is
///         intentionally the ONLY place `ECDSA.recover` is called across the entire platform. When
///         CRYSTALS-Dilithium becomes available for EVM chains, a `DilithiumSignatureVerifier` is
///         deployed and swapped in via the governed UUPS upgrade path (docs/SECURITY.md §6); no
///         calling contract changes.
contract ECDSASignatureVerifier is ISignatureVerifier {
    using ECDSA for bytes32;

    error UnsupportedKeyType(string keyType);

    function verify(
        bytes32 messageHash,
        bytes calldata signature,
        bytes calldata publicKey,
        string calldata keyType
    ) external pure override returns (bool) {
        if (keccak256(bytes(keyType)) != keccak256(bytes("ES256K"))) {
            revert UnsupportedKeyType(keyType);
        }
        // OZ v5: MessageHashUtils handles the Ethereum signed message prefix
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address recovered = ECDSA.recover(ethHash, signature);
        address expected = _pubKeyToAddress(publicKey);
        return recovered == expected;
    }

    function _pubKeyToAddress(bytes calldata publicKey) internal pure returns (address) {
        require(publicKey.length == 64, "invalid pubkey length");
        return address(uint160(uint256(keccak256(publicKey))));
    }
}
