import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  AssetMinted as AssetMintedEvent,
  MintProposed as MintProposedEvent,
  MintCoSigned as MintCoSignedEvent,
  Transfer as TransferEvent,
  AssetRegistry,
} from "../generated/AssetRegistry/AssetRegistry";
import { Asset, MintRequest, AuditEvent, Identity } from "../generated/schema";

export function handleMintProposed(event: MintProposedEvent): void {
  let req = new MintRequest(event.params.requestId.toString());
  req.requestId   = event.params.requestId;
  req.cid         = event.params.cid;
  // MintProposed doesn't emit vcId — AssetRegistry.sol's PendingMint struct doesn't store one
  // either (proposeMint's second param is actually `recipientDid`, not a vcId — see the
  // AssetRegistry.sol / vcIdOf note below and docs/API_SPEC.md flag on this). Leaving this
  // genuinely empty (rather than guessing a value) is the honest representation here.
  req.vcId        = Bytes.empty();
  // The real recipient wallet address (distinct from recipientDid) only exists in the contract's
  // pendingMints(requestId) storage, not in this event — read it via a bound call.
  let assetRegistry = AssetRegistry.bind(event.address);
  let pm = assetRegistry.try_pendingMints(event.params.requestId);
  req.recipient   = pm.reverted ? Bytes.empty() : pm.value.getRecipient();
  req.proposer    = event.transaction.from;
  req.executed    = false;
  req.proposedAt  = event.block.timestamp;
  req.save();
}

export function handleMintCoSigned(event: MintCoSignedEvent): void {
  let req = MintRequest.load(event.params.requestId.toString());
  if (req == null) return;
  req.coSigner = event.transaction.from;
  req.save();
}

export function handleAssetMinted(event: AssetMintedEvent): void {
  // Update the MintRequest as executed
  let req = MintRequest.load(event.params.requestId.toString());
  if (req != null) {
    req.executed    = true;
    req.executedAt  = event.block.timestamp;
    req.save();
  }

  // Create Asset entity
  let asset = new Asset(event.params.tokenId.toString());
  asset.tokenId       = event.params.tokenId;
  asset.cid           = event.params.cid;

  // AssetMinted doesn't carry the real owner wallet address (recipientDid is a DID hash, not an
  // address) — mint() calls _safeMint(recipient, tokenId) directly, so ownerOf(tokenId) is the
  // real current owner right after this event. vcIdOf(tokenId) is likewise a real, queryable
  // getter (AssetRegistry.sol currently stores the recipientDid there rather than an actual VC
  // id — a contract-level naming bug flagged separately, not fixed here — but this at least
  // mirrors real on-chain state instead of a hardcoded empty placeholder).
  let assetRegistry = AssetRegistry.bind(event.address);
  let ownerCall = assetRegistry.try_ownerOf(event.params.tokenId);
  asset.ownerAddress  = ownerCall.reverted ? Bytes.empty() : ownerCall.value;
  // Recorded once, at mint time, from the originating MintRequest — ownerAddress above mutates
  // on every subsequent real Transfer, so this is the only place the original recipient survives
  // for a later "was this ever transferred" comparison (T-063). Falls back to the just-read
  // current owner if the MintRequest is somehow missing (shouldn't happen — MintProposed always
  // precedes AssetMinted), which is still honest: at this exact moment they're the same address.
  asset.mintRecipient = req != null ? req.recipient : asset.ownerAddress;
  let vcIdCall = assetRegistry.try_vcIdOf(event.params.tokenId);
  asset.vcId          = vcIdCall.reverted ? Bytes.empty() : vcIdCall.value;
  let proposedBy: Bytes = event.transaction.from;
  let coSignedBy: Bytes = event.transaction.from;
  if (req != null) {
    proposedBy = req.proposer;
    if (req.coSigner !== null) {
      coSignedBy = changetype<Bytes>(req.coSigner);
    }
  }
  asset.proposedBy = proposedBy;
  asset.coSignedBy = coSignedBy;
  asset.mintedAt      = event.block.timestamp;
  asset.txHash        = event.transaction.hash;

  // Link to Identity if one exists for the recipient
  let ownerDid = Identity.load(event.params.recipientDid.toHexString());
  if (ownerDid != null) asset.owner = ownerDid.id;

  asset.save();

  let auditId = "AssetReg-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "AssetMinted";
  audit.actorAddress = event.transaction.from;
  audit.summary      = "Asset minted: token #" + event.params.tokenId.toString() + " → " + event.params.recipientDid.toHexString().slice(0, 10) + "…";
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}

export function handleTransfer(event: TransferEvent): void {
  // Update the owner on the Asset entity for any transfer (including mint-to)
  if (event.params.from.toHexString() == "0x0000000000000000000000000000000000000000") {
    return; // mint event already handled by handleAssetMinted
  }

  let asset = Asset.load(event.params.tokenId.toString());
  if (asset == null) return;

  asset.ownerAddress = event.params.to;
  let newOwner = Identity.load(event.params.to.toHexString());
  if (newOwner != null) {
    asset.owner = newOwner.id;
  } else {
    asset.owner = null;
  }
  asset.save();

  let auditId = "AssetReg-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "AssetTransferred";
  audit.actorAddress = event.params.from;
  audit.summary      = "Asset #" + event.params.tokenId.toString() + " transferred to " + event.params.to.toHexString().slice(0, 10) + "…";
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}
