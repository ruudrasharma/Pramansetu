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
    governanceTxs(first: 5, orderBy: queuedAt, orderDirection: desc) {
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
      owner {
        id
      }
      mintedAt
      proposedBy
      coSignedBy
    }
  }
`;

export const GET_GOVERNANCE = gql`
  query GetGovernance {
    governanceTxs(first: 50, orderBy: queuedAt, orderDirection: desc) {
      id
      txId
      target
      calldata
      eta
      executed
      queuedAt
      dispute {
        id
        reason
        resolved
      }
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
