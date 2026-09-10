import { gql } from 'graphql-request';

export const GET_DASHBOARD_DATA = gql`
  query GetDashboardData {
    identities(first: 10, orderBy: createdAt, orderDirection: desc) {
      id
      controller
      keyType
      createdAt
      credentials {
        id
        role
        revoked
        validUntil
      }
    }
    assets(first: 5, orderBy: mintedAt, orderDirection: desc) {
      id
      tokenId
      cid
      owner {
        id
      }
      mintedAt
      proposedBy
      coSignedBy
    }
    auditEvents(first: 15, orderBy: timestamp, orderDirection: desc) {
      id
      type
      actorAddress
      actorDid
      summary
      timestamp
      txHash
      riskScore
    }
    governanceTxes(first: 5, orderBy: queuedAt, orderDirection: desc) {
      id
      txId
      target
      calldata
      eta
      executed
      queuedAt
    }
  }
`;

export const GET_IDENTITIES = gql`
  query GetIdentities {
    identities(first: 50, orderBy: createdAt, orderDirection: desc) {
      id
      controller
      keyType
      createdAt
      credentials {
        id
        role
        validUntil
        revoked
      }
    }
  }
`;

export const GET_ASSETS = gql`
  query GetAssets {
    assets(first: 50, orderBy: mintedAt, orderDirection: desc) {
      id
      tokenId
      cid
      ownerAddress
      owner {
        id
      }
      vcId
      legalReference
      mintedAt
      proposedBy
      coSignedBy
      txHash
    }
  }
`;

export const GET_GOVERNANCE = gql`
  query GetGovernance {
    governanceTxes(first: 50, orderBy: queuedAt, orderDirection: desc) {
      id
      txId
      target
      calldata
      eta
      executed
      queuedAt
      dispute {
        id
        raisedBy
        reason
        resolved
        proceeded
        resolvedBy
        raisedAt
        resolvedAt
      }
    }
  }
`;

export const GET_PLATFORM_ACTIONS = gql`
  query GetPlatformActions {
    platformActions(first: 50, orderBy: proposedAt, orderDirection: desc) {
      id
      actionId
      actionType
      role
      account
      proposer
      coSigner
      executed
      proposedAt
      executedAt
    }
  }
`;

export const GET_PENDING_GRANTS = gql`
  query GetPendingGrants {
    pendingGrants(first: 50, orderBy: proposedAt, orderDirection: desc) {
      id
      grantId
      role
      account
      proposer
      coSigner
      executed
      proposedAt
      executedAt
    }
  }
`;

export const GET_CREDENTIALS_BY_SUBJECT = gql`
  query GetCredentialsBySubject($subject: String!) {
    credentials(where: { subject: $subject }, orderBy: issuedAt, orderDirection: desc) {
      id
      issuerDid
      vcHash
      role
      validUntil
      revoked
      revokedAt
      revokedBy
      issuedAt
      txHash
    }
  }
`;

export const GET_RECOVERY = gql`
  query GetRecovery($did: String!) {
    recovery(id: $did) {
      id
      did
      newController
      initiatedBy
      initiatedAt
      signers
      finalized
      finalizedAt
      txHash
    }
  }
`;

export const GET_AUDIT_EVENTS = gql`
  query GetAuditEvents($first: Int = 20, $skip: Int = 0) {
    auditEvents(first: $first, skip: $skip, orderBy: timestamp, orderDirection: desc) {
      id
      type
      actorAddress
      actorDid
      summary
      timestamp
      txHash
      riskScore
    }
  }
`;
