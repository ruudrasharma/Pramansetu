import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, keccak256, toBytes } from "viem";
import { sepolia } from "wagmi/chains";
import { CredentialRegistryAbi } from "@/lib/abis";

// CredentialRegistry's Sepolia deployment block (see deployments/sepolia.json).
const CREDENTIAL_REGISTRY_DEPLOY_BLOCK = 11_676_003;
const CREDENTIAL_ISSUED_TOPIC = keccak256(toBytes("CredentialIssued(bytes32,bytes32,bytes32,string,uint256)"));

/**
 * Server-side credential lookup, by subjectDid, straight off the chain — the subgraph-independent
 * replacement for lib/hooks/useCredentialRegistry.ts's original client-side chunked eth_getLogs
 * scan. That approach worked (verified: it does find the real event), but Alchemy's free tier
 * caps eth_getLogs at a 10-block range per call, and CredentialRegistry's deployment-to-now block
 * range has grown past a thousand 10-block windows over the life of this project — the scan was
 * technically correct but took well over a minute to finish, which just reads as "still pending"
 * to anyone looking at the page. Etherscan's getLogs API (module=logs&action=getLogs) has no such
 * per-call range cap, so this runs the same topic-filtered search there in ONE request instead,
 * then reads each vcId's live credentials(vcId) struct directly from the chain for authoritative
 * role/validUntil/revoked state (Etherscan's log data isn't used for those fields, only to find
 * which vcIds exist). Server-only because it needs ETHERSCAN_API_KEY.
 */
export async function GET(req: NextRequest) {
  const did = req.nextUrl.searchParams.get("did");
  if (!did || !/^0x[0-9a-fA-F]{64}$/.test(did)) {
    return NextResponse.json({ error: "Query param 'did' must be a 0x-prefixed 32-byte hex value." }, { status: 400 });
  }

  const apiKey = process.env.ETHERSCAN_API_KEY;
  const address = process.env.NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS;
  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
  if (!apiKey || !address || !rpcUrl) {
    return NextResponse.json(
      { error: "ETHERSCAN_API_KEY / NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS / NEXT_PUBLIC_SEPOLIA_RPC_URL are not fully configured on the server." },
      { status: 500 }
    );
  }

  const logsUrl = new URL("https://api.etherscan.io/v2/api");
  logsUrl.searchParams.set("chainid", "11155111");
  logsUrl.searchParams.set("module", "logs");
  logsUrl.searchParams.set("action", "getLogs");
  logsUrl.searchParams.set("address", address);
  logsUrl.searchParams.set("topic0", CREDENTIAL_ISSUED_TOPIC);
  logsUrl.searchParams.set("topic2", did);
  logsUrl.searchParams.set("topic0_2_opr", "and");
  logsUrl.searchParams.set("fromBlock", String(CREDENTIAL_REGISTRY_DEPLOY_BLOCK));
  logsUrl.searchParams.set("toBlock", "latest");
  logsUrl.searchParams.set("apikey", apiKey);

  const logsRes = await fetch(logsUrl, { cache: "no-store" });
  if (!logsRes.ok) {
    return NextResponse.json({ error: "Etherscan getLogs request failed." }, { status: 502 });
  }
  const logsData = await logsRes.json();
  if (logsData.status !== "1" && logsData.message !== "No records found") {
    return NextResponse.json({ error: `Etherscan getLogs error: ${logsData.result ?? logsData.message}` }, { status: 502 });
  }

  const logs: Array<{ topics: string[] }> = Array.isArray(logsData.result) ? logsData.result : [];
  const vcIds = Array.from(new Set(logs.map((log) => log.topics[1]).filter((id): id is string => !!id)));

  const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const credentials = await Promise.all(
    vcIds.map(async (vcId) => {
      const [subjectDid, issuerDid, vcHash, role, validUntil, revoked] = (await client.readContract({
        address: address as `0x${string}`,
        abi: CredentialRegistryAbi,
        functionName: "credentials",
        args: [vcId as `0x${string}`],
      })) as readonly [string, string, string, string, bigint, boolean, boolean];
      return {
        vcId,
        subjectDid,
        issuerDid,
        vcHash,
        role,
        validUntil: Number(validUntil) * 1000,
        revoked,
      };
    })
  );

  credentials.sort((a, b) => b.validUntil - a.validUntil);
  return NextResponse.json({ credentials });
}
