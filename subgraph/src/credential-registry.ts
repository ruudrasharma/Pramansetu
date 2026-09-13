import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  CredentialIssued as CredentialIssuedEvent,
  CredentialRevoked as CredentialRevokedEvent,
  CredentialRegistry,
} from "../generated/CredentialRegistry/CredentialRegistry";
import { Credential, Identity, AuditEvent } from "../generated/schema";
import { truncateMiddle } from "./utils";

export function handleCredentialIssued(event: CredentialIssuedEvent): void {
  // Ensure a stub Identity exists for the subject even if DIDCreated hasn't been indexed yet
  let subjectId = event.params.subjectDid.toHexString();
  let identity = Identity.load(subjectId);
  if (identity == null) {
    identity = new Identity(subjectId);
    identity.controller   = Bytes.empty();
    identity.keyType      = "ES256K";
    identity.pubKey       = Bytes.empty();
    identity.metadataURI  = "";
    identity.createdAt    = event.block.timestamp;
    identity.updatedAt    = event.block.timestamp;
    identity.save();
  }

  let cred = new Credential(event.params.vcId.toHexString());
  cred.subject      = subjectId;
  cred.issuerDid    = event.params.issuerDid;

  // CredentialIssued doesn't emit vcHash — read the real value from the credentials(vcId) getter.
  let credRegistry = CredentialRegistry.bind(event.address);
  let stored = credRegistry.try_credentials(event.params.vcId);
  cred.vcHash = stored.reverted ? Bytes.empty() : stored.value.getVcHash();
  cred.role         = event.params.role;
  cred.validUntil   = event.params.validUntil;
  cred.revoked      = false;
  cred.issuedAt     = event.block.timestamp;
  cred.txHash       = event.transaction.hash;
  cred.save();

  let auditId = "CredReg-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "CredentialIssued";
  audit.actorAddress = event.transaction.from;
  audit.actorDid     = event.params.issuerDid;
  audit.summary      = "Credential issued: " + event.params.role + " to " + truncateMiddle(subjectId);
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}

export function handleCredentialRevoked(event: CredentialRevokedEvent): void {
  let cred = Credential.load(event.params.vcId.toHexString());
  if (cred == null) return;

  cred.revoked    = true;
  cred.revokedAt  = event.block.timestamp;
  cred.revokedBy  = event.transaction.from;
  cred.save();

  let auditId = "CredReg-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "CredentialRevoked";
  audit.actorAddress = event.transaction.from;
  audit.summary      = "Credential revoked: " + truncateMiddle(event.params.vcId.toHexString());
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}
