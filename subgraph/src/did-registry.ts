import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  DIDCreated as DIDCreatedEvent,
  KeyRotated as KeyRotatedEvent,
  DIDRegistry,
} from "../generated/DIDRegistry/DIDRegistry";
import { Identity, AuditEvent } from "../generated/schema";
import { truncateMiddle } from "./utils";

export function handleDIDCreated(event: DIDCreatedEvent): void {
  // Create or update the Identity entity keyed by DID hash
  let identity = new Identity(event.params.did.toHexString());
  identity.controller   = event.params.controller;
  identity.keyType      = event.params.keyType;

  // DIDCreated only emits (did, controller, keyType, timestamp) — no pubKey/metadataURI. Read the
  // real values via a bound resolveDID() call instead of reusing an adjacent event param.
  let didRegistry = DIDRegistry.bind(event.address);
  let doc = didRegistry.try_resolveDID(event.params.did);
  if (!doc.reverted) {
    identity.pubKey      = doc.value.pubKey;
    identity.metadataURI = doc.value.metadataURI;
  } else {
    identity.pubKey      = Bytes.empty();
    identity.metadataURI = "";
  }
  identity.createdAt    = event.block.timestamp;
  identity.updatedAt    = event.block.timestamp;
  identity.save();

  // Write a unified AuditEvent record for the Overview ledger
  let auditId = "DIDRegistry-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type          = "DIDCreated";
  audit.actorAddress  = event.params.controller;
  audit.actorDid      = event.params.did;
  audit.summary       = "DID created: " + truncateMiddle(event.params.did.toHexString());
  audit.timestamp     = event.block.timestamp;
  audit.blockNumber   = event.block.number;
  audit.txHash        = event.transaction.hash;
  audit.save();
}

export function handleKeyRotated(event: KeyRotatedEvent): void {
  let identity = Identity.load(event.params.did.toHexString());
  if (identity == null) return; // guard: should always exist

  identity.controller = event.params.newController;
  identity.keyType = event.params.keyType;

  // Same fix as handleDIDCreated: KeyRotated doesn't emit pubKey/metadataURI either.
  let didRegistry = DIDRegistry.bind(event.address);
  let doc = didRegistry.try_resolveDID(event.params.did);
  if (!doc.reverted) {
    identity.pubKey = doc.value.pubKey;
    identity.metadataURI = doc.value.metadataURI;
  }
  identity.updatedAt = event.block.timestamp;
  identity.save();

  let auditId = "DIDRegistry-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "KeyRotated"; // lib/mock-data.ts's EventType already includes this — no need to reuse DIDCreated
  audit.actorAddress = event.transaction.from;
  audit.actorDid     = event.params.did;
  audit.summary      = "Key rotated for: " + truncateMiddle(event.params.did.toHexString());
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}
