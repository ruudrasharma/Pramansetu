// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title CredentialRegistry
/// @notice Verifiable Credential issuance/revocation registry. A DID is functionally worthless
///         without a non-revoked VC from an authorized BEL issuer — this is what closes the Sybil
///         and "DID != real identity" gaps (docs/SECURITY.md §5.2). Only the VC hash and
///         revocation status ever touch the chain; the VC payload itself stays in the holder's
///         wallet for privacy.
contract CredentialRegistry is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Credential {
        bytes32 subjectDid;
        bytes32 issuerDid;
        bytes32 vcHash;
        string role;
        uint256 validUntil;
        bool revoked;
        bool exists;
    }

    mapping(bytes32 => Credential) public credentials; // vcId => Credential

    event CredentialIssued(
        bytes32 indexed vcId,
        bytes32 indexed subjectDid,
        bytes32 indexed issuerDid,
        string role,
        uint256 validUntil
    );
    event CredentialRevoked(bytes32 indexed vcId, uint256 timestamp);

    error CredentialAlreadyExists();
    error CredentialNotFound();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function issueCredential(
        bytes32 subjectDid,
        bytes32 issuerDid,
        bytes32 vcHash,
        string calldata role,
        uint256 validUntil
    ) external onlyRole(ISSUER_ROLE) returns (bytes32 vcId) {
        vcId = keccak256(abi.encodePacked(subjectDid, issuerDid, vcHash, block.timestamp));
        if (credentials[vcId].exists) revert CredentialAlreadyExists();

        credentials[vcId] = Credential({
            subjectDid: subjectDid,
            issuerDid: issuerDid,
            vcHash: vcHash,
            role: role,
            validUntil: validUntil,
            revoked: false,
            exists: true
        });

        emit CredentialIssued(vcId, subjectDid, issuerDid, role, validUntil);
    }

    function revokeCredential(bytes32 vcId) external onlyRole(ISSUER_ROLE) {
        if (!credentials[vcId].exists) revert CredentialNotFound();
        credentials[vcId].revoked = true;
        emit CredentialRevoked(vcId, block.timestamp);
    }

    /// @notice Checked by every role-gated action across M2/M3 before honoring a role claim.
    function isValid(bytes32 vcId) external view returns (bool) {
        Credential storage c = credentials[vcId];
        return c.exists && !c.revoked && block.timestamp < c.validUntil;
    }
}
