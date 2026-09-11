import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SemaphoreRoleGroups, TimeBoundAccessControl } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import { generateProof, verifyProof } from "@semaphore-protocol/proof";

/**
 * SemaphoreRoleGroups tests — TESTING.md §1 "SemaphoreRoleGroups.test.ts" (T-015, gap analysis
 * §2.1.4). Deploys a REAL local Semaphore + SemaphoreVerifier instance (the actual protocol
 * contracts, not a hand-rolled mock) so these tests exercise real circuit logic.
 * Covers: constructor creates 5 distinct groups; registerCommitment idempotency;
 * syncMember's live-hasRole reconciliation; removeMemberFromRole's real Merkle-proof removal; the
 * end-to-end FEATURES.md F1.4 edge case (revoke → remove → a proof against the old root fails).
 */
describe("SemaphoreRoleGroups", function () {
  let ac: TimeBoundAccessControl;
  let src: SemaphoreRoleGroups;
  let semaphoreAddr: string;

  let superAdmin: SignerWithAddress;
  let managerUser: SignerWithAddress;
  let stranger: SignerWithAddress;

  const SUPER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SUPER_ADMIN_ROLE"));
  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  const MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"));
  const AUDITOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUDITOR_ROLE"));
  const USER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("USER_ROLE"));

  beforeEach(async () => {
    [superAdmin, managerUser, stranger] = await ethers.getSigners();

    const ACFactory = await ethers.getContractFactory("TimeBoundAccessControl");
    ac = (await upgrades.deployProxy(ACFactory, [superAdmin.address], { kind: "uups" })) as unknown as TimeBoundAccessControl;
    await ac.waitForDeployment();

    const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
    // MANAGER_ROLE's admin is ADMIN_ROLE (initialize()), not SUPER_ADMIN_ROLE -- grant ADMIN_ROLE
    // to an intermediary first, same two-step pattern AssetRegistry.test.ts already establishes.
    const [, , , , adminUser] = await ethers.getSigners();
    await ac.connect(superAdmin).grantTimedRole(ADMIN_ROLE, adminUser.address, ts + 999999);
    await ac.connect(adminUser).grantTimedRole(MANAGER_ROLE, managerUser.address, ts + 999999);

    // Deploy a real local Semaphore instance (the actual protocol contracts). Semaphore.sol links
    // against the external PoseidonT3 library for its Merkle tree hashing.
    const PoseidonT3Factory = await ethers.getContractFactory("PoseidonT3");
    const poseidonT3 = await PoseidonT3Factory.deploy();
    await poseidonT3.waitForDeployment();

    const VerifierFactory = await ethers.getContractFactory("SemaphoreVerifier");
    const verifier = await VerifierFactory.deploy();
    await verifier.waitForDeployment();

    const SemaphoreFactory = await ethers.getContractFactory("Semaphore", {
      libraries: { PoseidonT3: await poseidonT3.getAddress() },
    });
    const semaphore = await SemaphoreFactory.deploy(await verifier.getAddress());
    await semaphore.waitForDeployment();
    semaphoreAddr = await semaphore.getAddress();

    const SRGFactory = await ethers.getContractFactory("SemaphoreRoleGroups");
    src = (await SRGFactory.deploy(await ac.getAddress(), semaphoreAddr)) as SemaphoreRoleGroups;
    await src.waitForDeployment();
  });

  describe("constructor", () => {
    it("creates 5 distinct groups, one per role", async () => {
      // Semaphore's groupCounter starts at 0, so groupId 0 is a legitimate id, not a "missing"
      // sentinel -- the real requirement is distinctness, not non-zero-ness.
      const ids = await Promise.all(
        [SUPER_ADMIN_ROLE, ADMIN_ROLE, MANAGER_ROLE, AUDITOR_ROLE, USER_ROLE].map((r) => src.groupIdOf(r))
      );
      const unique = new Set(ids.map((id) => id.toString()));
      expect(unique.size).to.equal(5);
    });
  });

  describe("registerCommitment", () => {
    it("registers a commitment and emits CommitmentRegistered", async () => {
      const identity = new Identity();
      await expect(src.connect(managerUser).registerCommitment(identity.commitment))
        .to.emit(src, "CommitmentRegistered")
        .withArgs(managerUser.address, identity.commitment);
      expect(await src.commitmentOf(managerUser.address)).to.equal(identity.commitment);
    });

    it("reverts AlreadyRegistered on a second call", async () => {
      const identity = new Identity();
      await src.connect(managerUser).registerCommitment(identity.commitment);
      await expect(
        src.connect(managerUser).registerCommitment(new Identity().commitment)
      ).to.be.revertedWithCustomError(src, "AlreadyRegistered");
    });
  });

  describe("syncMember", () => {
    it("reverts NotRegistered before registerCommitment", async () => {
      await expect(
        src.connect(managerUser).syncMember(MANAGER_ROLE, managerUser.address)
      ).to.be.revertedWithCustomError(src, "NotRegistered");
    });

    it("reverts RoleNotHeld for an account that doesn't hold the role", async () => {
      const identity = new Identity();
      await src.connect(stranger).registerCommitment(identity.commitment);
      await expect(
        src.connect(stranger).syncMember(MANAGER_ROLE, stranger.address)
      ).to.be.revertedWithCustomError(src, "RoleNotHeld");
    });

    it("syncs a real role holder and emits MemberSynced", async () => {
      const identity = new Identity();
      await src.connect(managerUser).registerCommitment(identity.commitment);
      await expect(src.syncMember(MANAGER_ROLE, managerUser.address))
        .to.emit(src, "MemberSynced")
        .withArgs(MANAGER_ROLE, managerUser.address, identity.commitment);
      expect(await src.isMember(MANAGER_ROLE, managerUser.address)).to.equal(true);
    });

    it("is a no-op (does not revert, does not re-emit) if already synced", async () => {
      const identity = new Identity();
      await src.connect(managerUser).registerCommitment(identity.commitment);
      await src.syncMember(MANAGER_ROLE, managerUser.address);
      await expect(src.syncMember(MANAGER_ROLE, managerUser.address)).to.not.emit(src, "MemberSynced");
    });
  });

  describe("removeMemberFromRole", () => {
    it("reverts RoleStillHeld while the role is still held", async () => {
      const identity = new Identity();
      await src.connect(managerUser).registerCommitment(identity.commitment);
      await src.syncMember(MANAGER_ROLE, managerUser.address);
      await expect(
        src.removeMemberFromRole(MANAGER_ROLE, managerUser.address, [])
      ).to.be.revertedWithCustomError(src, "RoleStillHeld");
    });

    it("reverts NotAMember if never synced", async () => {
      await expect(
        src.removeMemberFromRole(MANAGER_ROLE, stranger.address, [])
      ).to.be.revertedWithCustomError(src, "NotAMember");
    });

    it("removes a member with a real computed Merkle proof once the role is revoked", async () => {
      const identity = new Identity();
      await src.connect(managerUser).registerCommitment(identity.commitment);
      await src.syncMember(MANAGER_ROLE, managerUser.address);

      // Emergency-revoke MANAGER_ROLE from managerUser (sets roleExpiry to now, so hasRole() goes false).
      // MANAGER_ROLE's admin is ADMIN_ROLE, but emergencyRevoke works on any role via the generic
      // 2-of-N platform-action path regardless of role hierarchy -- grant a second SUPER_ADMIN first.
      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      const [, , , extra] = await ethers.getSigners();
      await ac.connect(superAdmin).grantTimedRole(SUPER_ADMIN_ROLE, extra.address, ts + 999999);
      const proposeTx = await ac.connect(superAdmin).proposePlatformAction(1, MANAGER_ROLE, managerUser.address);
      const r = await proposeTx.wait();
      const ev = r!.logs.map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "ActionProposed");
      await ac.connect(extra).coSignPlatformAction(ev!.args.actionId);
      expect(await ac.hasRole(MANAGER_ROLE, managerUser.address)).to.equal(false);

      // Reconstruct the group locally (real off-chain state, one real member: managerUser's commitment)
      // and compute the real Merkle proof siblings needed for on-chain removal.
      const group = new Group([identity.commitment]);
      const index = group.indexOf(identity.commitment);
      const merkleProof = group.generateMerkleProof(index);

      await expect(src.removeMemberFromRole(MANAGER_ROLE, managerUser.address, merkleProof.siblings))
        .to.emit(src, "MemberRemovedFromRole")
        .withArgs(MANAGER_ROLE, managerUser.address, identity.commitment);
      expect(await src.isMember(MANAGER_ROLE, managerUser.address)).to.equal(false);
    });
  });

  describe("end-to-end: real proof generation/verification, and the FEATURES.md F1.4 edge case", function () {
    // Real circuit proof generation downloads/uses real snark artifacts -- slower than the rest
    // of this suite.
    this.timeout(120000);

    it("a synced member can generate a real proof that verifies; after revoke+remove, the same proof's root is no longer current", async () => {
      const identity = new Identity();
      await src.connect(managerUser).registerCommitment(identity.commitment);
      await src.syncMember(MANAGER_ROLE, managerUser.address);

      const group = new Group([identity.commitment]);
      const scope = MANAGER_ROLE; // bytes32, used as-is -- BigNumberish-compatible hex string
      const proof = await generateProof(identity, group, "praman-setu-role-proof", scope);

      expect(await verifyProof(proof)).to.equal(true);

      const groupId = await src.groupIdOf(MANAGER_ROLE);
      const Semaphore = await ethers.getContractAt("Semaphore", semaphoreAddr);
      const onchainProof = {
        merkleTreeDepth: proof.merkleTreeDepth,
        merkleTreeRoot: proof.merkleTreeRoot,
        nullifier: proof.nullifier,
        message: proof.message,
        scope: proof.scope,
        points: proof.points,
      };
      expect(await Semaphore.verifyProof(groupId, onchainProof)).to.equal(true);

      // Now revoke + remove (same flow as the previous describe block).
      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      const [, , , extra] = await ethers.getSigners();
      await ac.connect(superAdmin).grantTimedRole(SUPER_ADMIN_ROLE, extra.address, ts + 999999);
      const proposeTx = await ac.connect(superAdmin).proposePlatformAction(1, MANAGER_ROLE, managerUser.address);
      const r = await proposeTx.wait();
      const ev = r!.logs.map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "ActionProposed");
      await ac.connect(extra).coSignPlatformAction(ev!.args.actionId);

      const index = group.indexOf(identity.commitment);
      const merkleProof = group.generateMerkleProof(index);
      await src.removeMemberFromRole(MANAGER_ROLE, managerUser.address, merkleProof.siblings);

      // Immediately after removal, the OLD root is still within Semaphore's default 1-hour
      // root-history grace window (createGroup(admin)'s default merkleTreeDuration) -- by design,
      // so a proof generated moments before a membership change doesn't spuriously fail. The old
      // proof still verifies right now; this is correct, real Semaphore behavior, not a bug.
      expect(await Semaphore.verifyProof(groupId, onchainProof)).to.equal(true);

      // Past the 1-hour window, the stale root is no longer accepted -- this is the actual
      // FEATURES.md F1.4 edge case ("must re-check the live Merkle root, not a cached one"),
      // exercised end-to-end rather than just asserted in a comment.
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);
      await expect(Semaphore.verifyProof(groupId, onchainProof)).to.be.reverted;
    });
  });
});
