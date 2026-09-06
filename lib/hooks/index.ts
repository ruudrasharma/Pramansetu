/**
 * lib/hooks/index.ts — single import point for all BEL Chain wagmi hooks.
 *
 * Usage:
 *   import { useResolveDID, useProposeMint, useHasRole } from "@/lib/hooks";
 */

// DIDRegistry
export {
  useResolveDID,
  useDIDOf,
  useCreateDID,
  useRotateKey,
} from "./useDIDRegistry";

// CredentialRegistry
export {
  useIsVCValid,
  useGetCredential,
  useIssueCredential,
  useRevokeCredential,
} from "./useCredentialRegistry";

// TimeBoundAccessControl
export {
  ROLE,
  useHasRole,
  useRoleExpiry,
  usePlatformPaused,
  useGrantTimedRole,
  useProposePlatformAction,
  useCoSignPlatformAction,
} from "./useAccessControl";

// AssetRegistry
export {
  useTokenURI,
  useVcIdOf,
  useOwnerOf,
  useProposeMint,
  useCoSignMint,
  useAttachLegalReference,
} from "./useAssetRegistry";

// GuardianRecovery
export {
  useGuardianAtIndex,
  useRecoveryThreshold,
  useActiveRecovery,
  useRegisterGuardians,
  useInitiateRecovery,
  useSignRecovery,
  useFinalizeRecovery,
} from "./useGuardianRecovery";

// GovernanceTimelock
export {
  useQueuedTx,
  useNextTxId,
  useQueueTransaction,
  useRaiseDispute,
  useExecuteTransaction,
} from "./useGovernanceTimelock";
