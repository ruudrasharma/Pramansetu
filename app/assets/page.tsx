"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useOwnerOf, useVcIdOf, useTokenURI, useHasRole, ROLE } from "@/lib/hooks";
import { useProposeMint } from "@/lib/hooks/useAssetRegistry";
import { uploadMetadataToIPFS } from "@/lib/ipfs";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { truncateMiddle } from "@/lib/utils";
import { FileCheck2, Upload, UserCheck, Boxes, Search } from "lucide-react";

const mintSteps = [
  { label: "Upload to IPFS", icon: Upload, done: true },
  { label: "Admin proposes", icon: FileCheck2, done: true },
  { label: "Manager co-signs", icon: UserCheck, done: false },
];

function AssetLookup() {
  const [tokenIdInput, setTokenIdInput] = useState("");
  const [searchTokenId, setSearchTokenId] = useState<bigint | undefined>();

  const { data: ownerDid, isLoading: isOwnerLoading } = useOwnerOf(searchTokenId);
  const { data: vcId } = useVcIdOf(searchTokenId);
  const { data: uri } = useTokenURI(searchTokenId);

  return (
    <Card className="flex flex-col gap-6 p-6">
      <div className="flex gap-2">
        <input 
          type="number"
          placeholder="Enter Token ID"
          className="flex-1 rounded-lg border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 placeholder:text-ink-600 focus:border-graphite-600 focus:outline-none"
          value={tokenIdInput}
          onChange={(e) => setTokenIdInput(e.target.value)}
        />
        <Button onClick={() => setSearchTokenId(tokenIdInput ? BigInt(tokenIdInput) : undefined)}>
          <Search size={14} />
          Lookup
        </Button>
      </div>

      {isOwnerLoading ? (
        <div className="flex items-center justify-center py-8 text-[13px] text-ink-500">Querying asset...</div>
      ) : searchTokenId !== undefined ? (
        ownerDid && ownerDid !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? (
          <div className="flex flex-col gap-3 rounded-lg border border-graphite-800 bg-graphite-900/50 p-4">
            <div className="flex items-center justify-between">
              <span className="mono-value text-[12px] text-ink-600">#{searchTokenId.toString()}</span>
              {vcId && vcId !== "0x0000000000000000000000000000000000000000000000000000000000000000" && <Badge tone="signal">Legal Ref</Badge>}
            </div>
            <div>
              <p className="text-[13px] font-medium text-ink-50">Token URI (CID)</p>
              <p className="mono-value mt-1 truncate text-[11px] text-ink-600">
                {uri || "ipfs://..."}
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-graphite-800 pt-3 text-[12px]">
              <span className="text-ink-400">Owner DID</span>
              <span className="mono-value text-ink-200">{truncateMiddle(ownerDid, 10, 4)}</span>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-[13px] text-ink-500">Asset not found or not minted yet.</div>
        )
      ) : (
        <div className="py-8 text-center text-[13px] text-ink-600">Enter a Token ID to view asset details directly from the chain.</div>
      )}
    </Card>
  );
}

export default function AssetsPage() {
  const { address } = useAccount();
  const { data: isAdmin } = useHasRole(ROLE.ADMIN_ROLE, address);
  
  const [showMintForm, setShowMintForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "", vcId: "", recipient: "" });
  const [isUploading, setIsUploading] = useState(false);
  const { proposeMint, isPending, isSuccess } = useProposeMint();

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.description || !formData.vcId || !formData.recipient) return;
    try {
      setIsUploading(true);
      const cid = await uploadMetadataToIPFS({
        name: formData.name,
        description: formData.description,
      });
      setIsUploading(false);
      proposeMint({ cid, vcId: formData.vcId as `0x${string}`, recipient: formData.recipient as `0x${string}` });
    } catch (err) {
      console.error(err);
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-medium text-ink-50">Digital asset registry</h2>
          <p className="mt-0.5 text-[13px] text-ink-400">
            ERC-721 tokens, content-addressed on IPFS, minted only with dual attestation.
          </p>
        </div>
        <Button disabled={!isAdmin} onClick={() => setShowMintForm(!showMintForm)}>
          <Boxes size={14} />
          {showMintForm ? "Cancel" : "Propose mint"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-5">
          <AssetLookup />
          {showMintForm && (
            <Card className="p-6 border-alert-500/30">
              <h3 className="mb-4 text-[14px] font-medium text-ink-50 flex items-center gap-2">
                <Upload size={14} /> Propose Asset Mint
              </h3>
              <form onSubmit={handleMint} className="flex flex-col gap-4">
                <div>
                  <label className="text-[12px] text-ink-400 mb-1 block">Asset Name</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full rounded-lg border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50" />
                </div>
                <div>
                  <label className="text-[12px] text-ink-400 mb-1 block">Description</label>
                  <input required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full rounded-lg border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50" />
                </div>
                <div>
                  <label className="text-[12px] text-ink-400 mb-1 block">Legal Ref VC ID (bytes32)</label>
                  <input required value={formData.vcId} onChange={e => setFormData({...formData, vcId: e.target.value})} placeholder="0x..." className="w-full rounded-lg border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 mono-value" />
                </div>
                <div>
                  <label className="text-[12px] text-ink-400 mb-1 block">Recipient Address</label>
                  <input required value={formData.recipient} onChange={e => setFormData({...formData, recipient: e.target.value})} placeholder="0x..." className="w-full rounded-lg border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 mono-value" />
                </div>
                <Button disabled={isUploading || isPending} className="mt-2" variant="primary">
                  {isUploading ? "Uploading to IPFS..." : isPending ? "Confirming tx..." : "Submit Proposal"}
                </Button>
                {isSuccess && <p className="text-[12px] text-verified-400 mt-2">Proposal submitted to chain!</p>}
              </form>
            </Card>
          )}
        </div>

        <Card>
          <h3 className="mb-4 text-[14px] font-medium text-ink-50">Mint flow — Asset #45</h3>
          <div className="flex flex-col gap-4">
            {mintSteps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                    step.done
                      ? "border-verified-500/40 bg-verified-500/10 text-verified-400"
                      : "border-graphite-700 bg-graphite-800 text-ink-600"
                  }`}
                >
                  <step.icon size={14} strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                  <p className={`text-[13px] ${step.done ? "text-ink-50" : "text-ink-400"}`}>
                    {step.label}
                  </p>
                </div>
                {step.done && <Badge tone="verified">done</Badge>}
                {i < mintSteps.length - 1 && (
                  <span className="absolute ml-4 mt-8 h-4 w-px bg-graphite-700" aria-hidden />
                )}
              </div>
            ))}
          </div>
          <Button variant="secondary" className="mt-5 w-full" disabled>
            Awaiting Manager co-signature
          </Button>
        </Card>
      </div>
    </div>
  );
}
