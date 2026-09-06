// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ISignatureVerifier
/// @notice Crypto-agility boundary. Every signature check in the platform routes through this
///         interface instead of an inline `ecrecover()` call, so the underlying signature scheme
///         (ECDSA today, CRYSTALS-Dilithium once mature EVM implementations exist) can be swapped
///         behind the governed upgrade path without migrating any identity, role, or asset data.
///         See docs/SECURITY.md §6.
interface ISignatureVerifier {
    /// @notice Verifies `signature` over `messageHash` was produced by the key registered for `keyType`.
    /// @param messageHash keccak256 hash of the signed payload (e.g. a challenge nonce).
    /// @param signature Raw signature bytes; format depends on `keyType`.
    /// @param publicKey The public key bytes registered against the DID being authenticated.
    /// @param keyType Algorithm identifier, e.g. "ES256K" (ECDSA secp256k1, current) or
    ///        "DILITHIUM3" (post-quantum, future).
    function verify(
        bytes32 messageHash,
        bytes calldata signature,
        bytes calldata publicKey,
        string calldata keyType
    ) external view returns (bool);
}
