import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  AssetMinted as AssetMintedEvent,
  MintProposed as MintProposedEvent,
  MintCoSigned as MintCoSignedEvent,
  Transfer as TransferEvent,
} from "../generated/AssetRegistry/AssetRegistry";
import { Asset, MintRequest, AuditEvent, Identity } from "../generated/schema";

export function handleMintProposed(event: MintProposedEvent): void {
  let req = new MintRequest(event.params.requestId.toString());
  req.requestId   = event.params.requestId;
  req.cid         = event.params.cid;
  req.vcId        = event.params.vcId;
  req.recipient   = event.params.recipient;
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
  asset.ownerAddress  = event.params.recipient;
  asset.vcId          = event.params.vcId;
  asset.proposedBy    = req != null ? req.proposer : event.transaction.from;
  asset.coSignedBy    = req != null && req.coSigner != null ? req.coSigner! : event.transaction.from;
  asset.mintedAt      = event.block.timestamp;
  asset.txHash        = event.transaction.hash;

  // Link to Identity if one exists for the recipient
  let ownerDid = Identity.load(event.params.recipient.toHexString());
  if (ownerDid != null) asset.owner = ownerDid.id;

  asset.save();

  let auditId = "AssetReg-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "AssetMinted";
  audit.actorAddress = event.transaction.from;
  audit.summary      = "Asset minted: token #" + event.params.tokenId.toString() + " → " + event.params.recipient.toHexString().slice(0, 10) + "…";
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
