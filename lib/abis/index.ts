/**
 * lib/abis/index.ts — typed ABI exports generated from Hardhat artifacts.
 * Import from here rather than directly from artifacts/ — this boundary lets us swap
 * the ABI source (Hardhat → Foundry, or direct JSON → viem codegen) without touching
 * every useReadContract call across the frontend.
 */

export { DIDRegistryAbi } from './DIDRegistry';
export { CredentialRegistryAbi } from './CredentialRegistry';
export { TimeBoundAccessControlAbi } from './TimeBoundAccessControl';
export { AssetRegistryAbi } from './AssetRegistry';
export { GuardianRecoveryAbi } from './GuardianRecovery';
export { GovernanceTimelockAbi } from './GovernanceTimelock';
export { OracleAttestationAbi } from './OracleAttestation';
export { SemaphoreRoleGroupsAbi } from './SemaphoreRoleGroups';
export { ISemaphoreAbi } from './ISemaphore';
