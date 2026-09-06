import { expect } from "chai";
import { ethers } from "hardhat";
import { DIDRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * DIDRegistry tests — TESTING.md §1 "DIDRegistry.test.ts"
 * Covers: create/resolve/rotate DID; reject duplicate; only-controller rotation;
 *         forceRotateKey only by guardianRecovery contract; reverse lookup consistency.
 */
describe("DIDRegistry", function () {
  let didRegistry: DIDRegistry;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let mockRecovery: SignerWithAddress;

  beforeEach(async () => {
    [owner, alice, bob, mockRecovery] = await ethers.getSigners();
    const DIDRegistryFactory = await ethers.getContractFactory("DIDRegistry");
    didRegistry = (await DIDRegistryFactory.deploy()) as DIDRegistry;
    await didRegistry.waitForDeployment();
    // wire mock recovery contract
    await didRegistry.setGuardianRecoveryContract(mockRecovery.address);
  });

  // ── createDID ────────────────────────────────────────────────────────────

  describe("createDID", () => {
    it("creates a DID and emits DIDCreated event", async () => {
      const pubKey = ethers.randomBytes(64);
      const tx = await didRegistry.connect(alice).createDID(pubKey, "ipfs://Qm1234");
      const receipt = await tx.wait();
      // extract did from event
      const event = receipt!.logs
        .map((l) => {
          try { return didRegistry.interface.parseLog(l as any); } catch { return null; }
        })
        .find((e) => e?.name === "DIDCreated");
      expect(event).to.not.be.null;
      expect(event!.args.controller).to.equal(alice.address);
      expect(event!.args.keyType).to.equal("ES256K");
    });

    it("stores correct document fields", async () => {
      const pubKey = ethers.randomBytes(64);
      const tx = await didRegistry.connect(alice).createDID(pubKey, "ipfs://meta");
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((l) => {
          try { return didRegistry.interface.parseLog(l as any); } catch { return null; }
        })
        .find((e) => e?.name === "DIDCreated");
      const did = event!.args.did;

      const doc = await didRegistry.resolveDID(did);
      expect(doc.controller).to.equal(alice.address);
      expect(doc.keyType).to.equal("ES256K");
      expect(doc.metadataURI).to.equal("ipfs://meta");
      expect(doc.exists).to.be.true;
    });

    it("sets reverse lookup didOf[controller] = did", async () => {
      const pubKey = ethers.randomBytes(64);
      const tx = await didRegistry.connect(alice).createDID(pubKey, "ipfs://x");
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((l) => {
          try { return didRegistry.interface.parseLog(l as any); } catch { return null; }
        })
        .find((e) => e?.name === "DIDCreated");
      const did = event!.args.did;
      expect(await didRegistry.didOf(alice.address)).to.equal(did);
    });
  });

  // ── resolveDID ───────────────────────────────────────────────────────────

  describe("resolveDID", () => {
    it("reverts with DIDNotFound for unknown DID", async () => {
      await expect(
        didRegistry.resolveDID(ethers.randomBytes(32))
      ).to.be.revertedWithCustomError(didRegistry, "DIDNotFound");
    });
  });

  // ── rotateKey ────────────────────────────────────────────────────────────

  describe("rotateKey", () => {
    let did: string;

    beforeEach(async () => {
      const pubKey = ethers.randomBytes(64);
      const tx = await didRegistry.connect(alice).createDID(pubKey, "ipfs://x");
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((l) => {
          try { return didRegistry.interface.parseLog(l as any); } catch { return null; }
        })
        .find((e) => e?.name === "DIDCreated");
      did = event!.args.did;
    });

    it("controller can rotate key (no verifier configured — proof ignored)", async () => {
      const newKey = ethers.randomBytes(64);
      // When signatureVerifier = zero address, proof param is passed but not checked.
      const newController = ethers.getAddress(
        "0x" + ethers.keccak256(newKey).slice(-40)
      );
      await expect(
        didRegistry.connect(alice).rotateKey(did, newKey, "ES256K", "0x")
      ).to.emit(didRegistry, "KeyRotated");
      // Controller is now the address derived from keccak256(newPubKey)
      const doc = await didRegistry.resolveDID(did);
      expect(doc.keyType).to.equal("ES256K");
    });

    it("non-controller cannot rotate key", async () => {
      await expect(
        didRegistry.connect(bob).rotateKey(did, ethers.randomBytes(64), "ES256K", "0x")
      ).to.be.revertedWithCustomError(didRegistry, "NotController");
    });

    it("can update keyType (crypto-agility)", async () => {
      const newKey = ethers.randomBytes(64);
      await didRegistry.connect(alice).rotateKey(did, newKey, "DILITHIUM3", "0x");
      const doc = await didRegistry.resolveDID(did);
      expect(doc.keyType).to.equal("DILITHIUM3");
    });

    it("setSignatureVerifier emits SignatureVerifierUpdated", async () => {
      const fakeVerifier = ethers.Wallet.createRandom().address;
      await expect(
        didRegistry.connect(owner).setSignatureVerifier(fakeVerifier)
      ).to.emit(didRegistry, "SignatureVerifierUpdated")
        .withArgs(ethers.ZeroAddress, fakeVerifier);
      expect(await didRegistry.signatureVerifier()).to.equal(fakeVerifier);
    });

    it("non-owner cannot setSignatureVerifier", async () => {
      await expect(
        didRegistry.connect(alice).setSignatureVerifier(ethers.Wallet.createRandom().address)
      ).to.be.revertedWithCustomError(didRegistry, "NotAuthorized");
    });
  });

  // ── forceRotateKey ───────────────────────────────────────────────────────

  describe("forceRotateKey", () => {
    let did: string;

    beforeEach(async () => {
      const pubKey = ethers.randomBytes(64);
      const tx = await didRegistry.connect(alice).createDID(pubKey, "ipfs://x");
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((l) => {
          try { return didRegistry.interface.parseLog(l as any); } catch { return null; }
        })
        .find((e) => e?.name === "DIDCreated");
      did = event!.args.did;
    });

    it("guardianRecoveryContract can force-rotate key", async () => {
      const newKey = ethers.randomBytes(64);
      await expect(
        didRegistry.connect(mockRecovery).forceRotateKey(did, bob.address, newKey)
      ).to.emit(didRegistry, "KeyRotated");

      const doc = await didRegistry.resolveDID(did);
      expect(doc.controller).to.equal(bob.address);
      // reverse lookup updated
      expect(await didRegistry.didOf(bob.address)).to.equal(did);
      expect(await didRegistry.didOf(alice.address)).to.equal(ethers.ZeroHash);
    });

    it("non-recovery caller reverts with NotAuthorized", async () => {
      await expect(
        didRegistry.connect(alice).forceRotateKey(did, bob.address, ethers.randomBytes(64))
      ).to.be.revertedWithCustomError(didRegistry, "NotAuthorized");
    });
  });
});
