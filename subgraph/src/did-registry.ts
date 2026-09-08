import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  DIDCreated as DIDCreatedEvent,
  KeyRotated as KeyRotatedEvent,
} from "../generated/DIDRegistry/DIDRegistry";
import { Identity, AuditEvent } from "../generated/schema";

export function handleDIDCreated(event: DIDCreatedEvent): void {
  // Create or update the Identity entity keyed by DID hash
  let identity = new Identity(event.params.did.toHexString());
  identity.controller   = event.params.controller;
  identity.keyType      = "ES256K"; // default; updated on KeyRotated
  identity.pubKey       = Bytes.empty();
  identity.metadataURI  = event.params.keyType; // the ABI actually named this string param 'keyType'
  identity.createdAt    = event.block.timestamp;
  identity.updatedAt    = event.block.timestamp;
  identity.save();

  // Write a unified AuditEvent record for the Overview ledger
  let auditId = "DIDRegistry-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type          = "DIDCreated";
  audit.actorAddress  = event.params.controller;
  audit.actorDid      = event.params.did;
  audit.summary       = "DID created: " + event.params.did.toHexString().slice(0, 14) + "…";
  audit.timestamp     = event.block.timestamp;
  audit.blockNumber   = event.block.number;
  audit.txHash        = event.transaction.hash;
  audit.save();
}

export function handleKeyRotated(event: KeyRotatedEvent): void {
  let identity = Identity.load(event.params.did.toHexString());
  if (identity == null) return; // guard: should always exist

  identity.controller = event.params.newController;
  identity.metadataURI = event.params.keyType; // the ABI actually named this string param 'keyType'
  identity.updatedAt = event.block.timestamp;
  identity.save();

  let auditId = "DIDRegistry-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "DIDCreated"; // closest existing type; extend EventType for KeyRotated
  audit.actorAddress = event.transaction.from;
  audit.actorDid     = event.params.did;
  audit.summary      = "Key rotated for: " + event.params.did.toHexString().slice(0, 14) + "…";
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}
