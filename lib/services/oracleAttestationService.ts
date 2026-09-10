"use client";

/**
 * lib/services/oracleAttestationService.ts — T-016 (gap analysis §2.2.5): decentralized oracle
 * design with multiple independent attestors and a dispute window before an oracle-fed real-world
 * fact (e.g. "this physical asset was delivered") becomes final on-chain. Same dual mock/onchain
 * hook pattern as governanceService.ts.
 */

import { dataMode } from "./dataMode";
import { useMockDataStore } from "@/lib/store/mockDataStore";
import { type OracleFact } from "@/lib/mock/fixtures";
import {
  useSubmitFact as useSubmitFactOnchain,
  useAttestFact as useAttestFactOnchain,
  useRaiseFactDispute as useRaiseFactDisputeOnchain,
  useResolveFactDispute as useResolveFactDisputeOnchain,
  useFinalizeFact as useFinalizeFactOnchain,
} from "@/lib/hooks/useOracleAttestation";
import { useQuery } from "@tanstack/react-query";
import { getGraphQLClient } from "@/lib/graphql";
import { GET_ORACLE_FACTS } from "@/lib/queries";

export interface OracleAttestationService {
  getFacts: () => OracleFact[];
  getFactsForAsset: (tokenId: number) => OracleFact[];
  submitFact: (input: { tokenId: number; factType: number; dataHash: string; proposer: string }) => void;
  attestFact: (factId: number, attestor: string) => void;
  raiseDispute: (factId: number, reason: string, disputedBy: string) => void;
  resolveDispute: (factId: number, proceed: boolean, resolvedBy: string) => void;
  finalize: (factId: number) => void;
  isPending: boolean;
}

function useMockOracleAttestationService(): OracleAttestationService {
  const store = useMockDataStore();

  return {
    getFacts: () => store.oracleFacts,
    getFactsForAsset: (tokenId) => store.oracleFacts.filter((f) => f.tokenId === tokenId),
    submitFact: (input) => {
      store.submitOracleFact(input);
    },
    attestFact: store.attestOracleFact,
    raiseDispute: store.raiseFactDispute,
    resolveDispute: store.resolveFactDispute,
    finalize: store.finalizeOracleFact,
    isPending: false,
  };
}

interface RawOracleFact {
  id: string;
  factId: string;
  tokenId: string;
  factType: number;
  dataHash: string;
  proposer: string;
  coSigner: string | null;
  status: string;
  submittedAt: string;
  disputeWindowEnd: string | null;
  disputedBy: string | null;
  disputeReason: string | null;
  resolvedProceed: boolean | null;
  finalizedAt: string | null;
}

function adaptFact(raw: RawOracleFact): OracleFact {
  return {
    factId: Number(raw.factId),
    tokenId: Number(raw.tokenId),
    factType: raw.factType,
    dataHash: raw.dataHash,
    proposer: raw.proposer,
    coSigner: raw.coSigner ?? undefined,
    status: raw.status as OracleFact["status"],
    submittedAt: Number(raw.submittedAt) * 1000,
    disputeWindowEnd: raw.disputeWindowEnd ? Number(raw.disputeWindowEnd) * 1000 : undefined,
    disputedBy: raw.disputedBy ?? undefined,
    disputeReason: raw.disputeReason ?? undefined,
    resolvedProceed: raw.resolvedProceed ?? undefined,
    finalizedAt: raw.finalizedAt ? Number(raw.finalizedAt) * 1000 : undefined,
  };
}

function useOnchainOracleAttestationService(): OracleAttestationService {
  const { submitFact, isPending: isSubmitting } = useSubmitFactOnchain();
  const { attestFact: attestFactOnchain, isPending: isAttesting } = useAttestFactOnchain();
  const { raiseFactDispute, isPending: isDisputing } = useRaiseFactDisputeOnchain();
  const { resolveFactDispute, isPending: isResolving } = useResolveFactDisputeOnchain();
  const { finalizeFact, isPending: isFinalizing } = useFinalizeFactOnchain();

  const factsQuery = useQuery({
    queryKey: ["oracleFacts"],
    queryFn: async () => getGraphQLClient().request<{ oracleFacts: RawOracleFact[] }>(GET_ORACLE_FACTS),
    refetchInterval: 10000,
  });

  const facts: OracleFact[] = (factsQuery.data?.oracleFacts ?? []).map(adaptFact);

  return {
    getFacts: () => facts,
    getFactsForAsset: (tokenId) => facts.filter((f) => f.tokenId === tokenId),
    submitFact: (input) => {
      submitFact({
        tokenId: BigInt(input.tokenId),
        factType: input.factType,
        dataHash: input.dataHash as `0x${string}`,
      });
    },
    attestFact: (factId) => attestFactOnchain(BigInt(factId)),
    raiseDispute: (factId, reason) => raiseFactDispute({ factId: BigInt(factId), reason }),
    resolveDispute: (factId, proceed) => resolveFactDispute({ factId: BigInt(factId), proceed }),
    finalize: (factId) => finalizeFact(BigInt(factId)),
    isPending: isSubmitting || isAttesting || isDisputing || isResolving || isFinalizing,
  };
}

export function useOracleAttestationService(): OracleAttestationService {
  // See didService.ts's useDidService for why both are called unconditionally.
  const mock = useMockOracleAttestationService();
  const onchain = useOnchainOracleAttestationService();
  return dataMode === "onchain" ? onchain : mock;
}
