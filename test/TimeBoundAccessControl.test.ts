import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { TimeBoundAccessControl } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * TimeBoundAccessControl tests — TESTING.md §1
 * Covers: hasRole false past expiry; 2-of-3 multisig gate on privileged grants;
 *         emergencyRevoke; pause/unpause blocks all state-changing calls.
 * 100% branch target per TESTING.md §1.
 */
describe("TimeBoundAccessControl", function () {
  let ac: TimeBoundAccessControl;
  let superAdmin: SignerWithAddress;
  let superAdmin2: SignerWithAddress;
  let admin: SignerWithAddress;
  let user: SignerWithAddress;
  let stranger: SignerWithAddress;

  const SUPER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SUPER_ADMIN_ROLE"));
  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  const MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"));
  const AUDITOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUDITOR_ROLE"));
  const USER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("USER_ROLE"));

  beforeEach(async () => {
    [superAdmin, superAdmin2, admin, user, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("TimeBoundAccessControl");
    ac = (await upgrades.deployProxy(Factory, [superAdmin.address], { kind: "uups" })) as unknown as TimeBoundAccessControl;
    await ac.waitForDeployment();

    // superAdmin2 needs SUPER_ADMIN_ROLE with a valid expiry so onlyRole(SUPER_ADMIN_ROLE) works.
    // Step 1: grant the OZ role flag (requires DEFAULT_ADMIN_ROLE → held by superAdmin via initialize)
    // Step 2: set expiry via grantTimedRole (requires DEFAULT_ADMIN_ROLE on SUPER_ADMIN_ROLE's admin)
    const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
    await ac.connect(superAdmin).grantRole(SUPER_ADMIN_ROLE, superAdmin2.address);
    // grantTimedRole(SUPER_ADMIN_ROLE, ...) → onlyRole(getRoleAdmin(SUPER_ADMIN_ROLE)) = onlyRole(DEFAULT_ADMIN_ROLE)
    // superAdmin has DEFAULT_ADMIN_ROLE with type(uint256).max expiry from initialize ✓
    await ac.connect(superAdmin).grantTimedRole(SUPER_ADMIN_ROLE, superAdmin2.address, ts + 999999);
  });

  // ── hasRole — time-bound expiry ──────────────────────────────────────────

  describe("hasRole — time-bound expiry", () => {
    it("returns false before expiry AND after expiry for a timed role", async () => {
      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      const validUntil = ts + 10; // 10 seconds from now

      // grant USER_ROLE (admin of USER_ROLE is ADMIN_ROLE; set that up first)
      await ac.connect(superAdmin).grantRole(ADMIN_ROLE, admin.address);
      await ac.connect(superAdmin).grantTimedRole(ADMIN_ROLE, admin.address, ts + 9999);

      await ac.connect(admin).grantTimedRole(USER_ROLE, user.address, validUntil);

      // immediately — role is active
      expect(await ac.hasRole(USER_ROLE, user.address)).to.be.true;

      // advance past expiry
      await ethers.provider.send("evm_increaseTime", [20]);
      await ethers.provider.send("evm_mine", []);

      // expired — hasRole must return false with NO revocation tx needed
      expect(await ac.hasRole(USER_ROLE, user.address)).to.be.false;
    });


    it("superAdmin SUPER_ADMIN_ROLE has far-future expiry from initialize", async () => {
      // After our initialize fix, superAdmin's roleExpiry is type(uint256).max — not 0.
      // This ensures hasRole() works for bootstrap accounts without a separate grantTimedRole call.
      const expiry = await ac.roleExpiry(SUPER_ADMIN_ROLE, superAdmin.address);
      expect(expiry).to.equal(ethers.MaxUint256);
    });
  });


  // ── grantTimedRole ───────────────────────────────────────────────────────

  describe("grantTimedRole", () => {
    beforeEach(async () => {
      // Ensure admin has ADMIN_ROLE granted (flag only; expiry is set by grantTimedRole in each test).
      await ac.connect(superAdmin).grantRole(ADMIN_ROLE, admin.address);
    });


    it("reverts when validUntil is in the past", async () => {
      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      await expect(
        ac.connect(superAdmin).grantTimedRole(ADMIN_ROLE, admin.address, ts - 1)
      ).to.be.revertedWithCustomError(ac, "ValidityInPast");
    });

    it("emits TimedRoleGranted and sets roleExpiry", async () => {
      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      const validUntil = ts + 86400;
      await expect(
        ac.connect(superAdmin).grantTimedRole(ADMIN_ROLE, admin.address, validUntil)
      ).to.emit(ac, "TimedRoleGranted").withArgs(ADMIN_ROLE, admin.address, validUntil);

      expect(await ac.roleExpiry(ADMIN_ROLE, admin.address)).to.equal(validUntil);
    });
  });

  // ── proposePrivilegedGrant / coSignGrant (2-of-3 multisig) ─────────────

  describe("proposePrivilegedGrant + coSignGrant", () => {
    it("executes the grant once GRANT_THRESHOLD signers co-sign", async () => {
      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      const validUntil = ts + 86400;

      const tx = await ac.connect(superAdmin).proposePrivilegedGrant(ADMIN_ROLE, admin.address, validUntil);
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "GrantProposed");
      const grantId = event!.args.grantId;

      // proposer has already signed (count = 1); GRANT_THRESHOLD = 2; co-sign to trigger
      await expect(
        ac.connect(superAdmin2).coSignGrant(grantId)
      ).to.emit(ac, "TimedRoleGranted");

      expect(await ac.roleExpiry(ADMIN_ROLE, admin.address)).to.equal(validUntil);
    });

    it("rejects duplicate signer", async () => {
      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      const validUntil = ts + 86400;

      const tx = await ac.connect(superAdmin).proposePrivilegedGrant(ADMIN_ROLE, admin.address, validUntil);
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "GrantProposed");
      const grantId = event!.args.grantId;

      await expect(
        ac.connect(superAdmin).coSignGrant(grantId)
      ).to.be.revertedWithCustomError(ac, "DuplicateSigner");
    });

    it("rejects AlreadyExecuted on a second coSign after threshold met", async () => {
      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      const validUntil = ts + 86400;

      const tx = await ac.connect(superAdmin).proposePrivilegedGrant(ADMIN_ROLE, admin.address, validUntil);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } }).find((e) => e?.name === "GrantProposed");
      const grantId = ev!.args.grantId;

      await ac.connect(superAdmin2).coSignGrant(grantId);

      // Third signer tries after already executed
      const [,,,,extra] = await ethers.getSigners();
      // grantRole sets the OZ flag; grantTimedRole sets roleExpiry so our hasRole override passes
      await ac.connect(superAdmin).grantRole(SUPER_ADMIN_ROLE, extra.address);
      await ac.connect(superAdmin).grantTimedRole(SUPER_ADMIN_ROLE, extra.address, ts + 86400);
      await expect(
        ac.connect(extra).coSignGrant(grantId)
      ).to.be.revertedWithCustomError(ac, "AlreadyExecuted");
    });
  });

  // ── emergencyRevoke ──────────────────────────────────────────────────────

  describe("emergencyRevoke", () => {
    it("SUPER_ADMIN can instantly expire a role", async () => {
      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      // Grant AUDITOR_ROLE (admin = SUPER_ADMIN_ROLE, so superAdmin can call grantTimedRole directly)
      await ac.connect(superAdmin).grantTimedRole(AUDITOR_ROLE, user.address, ts + 86400);

      // sanity: roleExpiry is set
      expect(await ac.roleExpiry(AUDITOR_ROLE, user.address)).to.be.gt(0);

      await expect(
        ac.connect(superAdmin).emergencyRevoke(AUDITOR_ROLE, user.address)
      ).to.emit(ac, "EmergencyRevoked");

      // roleExpiry now = block.timestamp → hasRole returns false
      expect(await ac.hasRole(AUDITOR_ROLE, user.address)).to.be.false;
    });

    it("non-SUPER_ADMIN cannot emergencyRevoke", async () => {
      await expect(
        ac.connect(stranger).emergencyRevoke(AUDITOR_ROLE, user.address)
      ).to.be.revertedWithCustomError(ac, "AccessControlUnauthorizedAccount");
    });
  });

  // ── pause / unpause ──────────────────────────────────────────────────────

  describe("pause / unpause", () => {
    it("SUPER_ADMIN can pause and grantTimedRole is blocked when paused", async () => {
      await ac.connect(superAdmin).pause();
      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      await expect(
        ac.connect(superAdmin).grantTimedRole(AUDITOR_ROLE, user.address, ts + 86400)
      ).to.be.revertedWithCustomError(ac, "EnforcedPause");
    });

    it("proposePrivilegedGrant is blocked when paused", async () => {
      await ac.connect(superAdmin).pause();
      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      await expect(
        ac.connect(superAdmin).proposePrivilegedGrant(ADMIN_ROLE, admin.address, ts + 86400)
      ).to.be.revertedWithCustomError(ac, "EnforcedPause");
    });

    it("unpause restores operation", async () => {
      await ac.connect(superAdmin).pause();
      await ac.connect(superAdmin).unpause();
      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      await expect(
        ac.connect(superAdmin).grantTimedRole(AUDITOR_ROLE, user.address, ts + 86400)
      ).to.emit(ac, "TimedRoleGranted");
    });

    it("non-SUPER_ADMIN cannot pause", async () => {
      await expect(
        ac.connect(stranger).pause()
      ).to.be.revertedWithCustomError(ac, "AccessControlUnauthorizedAccount");
    });
  });

  // ── UUPS upgrade auth ────────────────────────────────────────────────────

  describe("UUPS upgrade", () => {
    it("SUPER_ADMIN can upgrade implementation", async () => {
      const Factory = await ethers.getContractFactory("TimeBoundAccessControl");
      // Should not revert
      await expect(
        upgrades.upgradeProxy(await ac.getAddress(), Factory.connect(superAdmin))
      ).to.not.be.reverted;
    });

    it("non-SUPER_ADMIN cannot authorize upgrade", async () => {
      const Factory = await ethers.getContractFactory("TimeBoundAccessControl");
      await expect(
        upgrades.upgradeProxy(await ac.getAddress(), Factory.connect(stranger))
      ).to.be.reverted;
    });
  });
});
