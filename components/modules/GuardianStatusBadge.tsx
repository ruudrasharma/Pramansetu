"use client";

import { ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { findIdentity } from "@/lib/mock/fixtures";
import { useDidService } from "@/lib/services/didService";
import { useDIDOf } from "@/lib/hooks/useDIDRegistry";
import { dataMode } from "@/lib/services/dataMode";

const ZERO_BYTES32 = ("0x" + "0".repeat(64)) as `0x${string}`;

/**
 * docs/FEATURES.md F1.3's flagged edge case: GuardianRecovery.sol has no concept of an
 * "off-boarded" guardian — a guardian whose own DID/role has since been revoked is still a
 * fully valid signer as far as the contract is concerned. This is a UI-only warning on top of
 * that real contract behavior, never a block, so a viewer can judge whether a guardian set still
 * reflects who they'd actually trust today.
 *
 * `guardianRef` is a DID in mock mode (guardian sets are built from mock `Identity.did`s) and a
 * controller address in onchain mode (`GuardianRecovery.guardiansOf` returns `address[]`) — same
 * duality every other guardian-list consumer in this app already handles via `findIdentity(g)`.
 */
export function GuardianStatusBadge({ guardianRef }: { guardianRef: string }) {
  const { data: onchainDidHash } = useDIDOf(
    dataMode === "onchain" ? (guardianRef as `0x${string}`) : undefined
  );
  const resolvedOnchainDid =
    onchainDidHash && onchainDidHash !== ZERO_BYTES32 ? (onchainDidHash as string) : undefined;

  const did = dataMode === "mock" ? guardianRef : resolvedOnchainDid;
  const guardianDidService = useDidService(did);

  const guardianIdentity =
    dataMode === "mock" ? findIdentity(guardianRef) : guardianDidService.resolveDID();

  if (guardianIdentity?.credentialStatus !== "revoked") return null;

  return (
    <Badge tone="alert" className="shrink-0">
      <ShieldOff size={11} /> Off-boarded
    </Badge>
  );
}
