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

  // ── proposePlatformAction / coSignPlatformAction ──────────────────────
  // Replaces: direct emergencyRevoke(), pause(), unpause() — all now require 2 SUPER_ADMIN sigs.

  describe("proposePlatformAction / coSignPlatformAction", () => {
    let auditorExpiry: number;

    beforeEach(async () => {
      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      auditorExpiry = ts + 86400;
      // Grant AUDITOR_ROLE to user so we can test emergencyRevoke (actionType=1)
      await ac.connect(superAdmin).grantTimedRole(AUDITOR_ROLE, user.address, auditorExpiry);
    });

    it("non-SUPER_ADMIN cannot propose a platform action", async () => {
      await expect(
        ac.connect(stranger).proposePlatformAction(2, ethers.ZeroHash, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(ac, "AccessControlUnauthorizedAccount");
    });

    it("rejects invalid actionType", async () => {
      await expect(
        ac.connect(superAdmin).proposePlatformAction(0, ethers.ZeroHash, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(ac, "InvalidActionType");
      await expect(
        ac.connect(superAdmin).proposePlatformAction(4, ethers.ZeroHash, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(ac, "InvalidActionType");
    });

    it("rejects duplicate signer on coSign", async () => {
      const tx = await ac.connect(superAdmin).proposePlatformAction(2, ethers.ZeroHash, ethers.ZeroAddress);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "ActionProposed");
      await expect(
        ac.connect(superAdmin).coSignPlatformAction(ev!.args.actionId)
      ).to.be.revertedWithCustomError(ac, "DuplicateSigner");
    });

    it("actionType=1 (emergencyRevoke): 2 SUPER_ADMINs expire a role", async () => {
      expect(await ac.hasRole(AUDITOR_ROLE, user.address)).to.be.true;

      const tx = await ac.connect(superAdmin).proposePlatformAction(1, AUDITOR_ROLE, user.address);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "ActionProposed");

      await expect(
        ac.connect(superAdmin2).coSignPlatformAction(ev!.args.actionId)
      ).to.emit(ac, "EmergencyRevoked").withArgs(AUDITOR_ROLE, user.address, superAdmin2.address);

      expect(await ac.hasRole(AUDITOR_ROLE, user.address)).to.be.false;
    });

    it("actionType=2 (pause): 2 SUPER_ADMINs pause the contract", async () => {
      const tx = await ac.connect(superAdmin).proposePlatformAction(2, ethers.ZeroHash, ethers.ZeroAddress);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "ActionProposed");

      await expect(
        ac.connect(superAdmin2).coSignPlatformAction(ev!.args.actionId)
      ).to.emit(ac, "ActionExecuted");

      // grantTimedRole is now blocked
      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      await expect(
        ac.connect(superAdmin).grantTimedRole(AUDITOR_ROLE, stranger.address, ts + 86400)
      ).to.be.revertedWithCustomError(ac, "EnforcedPause");
    });

    it("actionType=3 (unpause): 2 SUPER_ADMINs restore operation", async () => {
      // pause first via 2-of-2
      const tx1 = await ac.connect(superAdmin).proposePlatformAction(2, ethers.ZeroHash, ethers.ZeroAddress);
      const r1 = await tx1.wait();
      const ev1 = r1!.logs.map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "ActionProposed");
      await ac.connect(superAdmin2).coSignPlatformAction(ev1!.args.actionId);

      // unpause via 2-of-2
      const tx2 = await ac.connect(superAdmin).proposePlatformAction(3, ethers.ZeroHash, ethers.ZeroAddress);
      const r2 = await tx2.wait();
      const ev2 = r2!.logs.map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "ActionProposed");
      await ac.connect(superAdmin2).coSignPlatformAction(ev2!.args.actionId);

      // grantTimedRole works again
      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      await expect(
        ac.connect(superAdmin).grantTimedRole(AUDITOR_ROLE, stranger.address, ts + 86400)
      ).to.emit(ac, "TimedRoleGranted");
    });

    it("proposePrivilegedGrant is blocked when platform is paused", async () => {
      // pause via 2-of-2
      const tx = await ac.connect(superAdmin).proposePlatformAction(2, ethers.ZeroHash, ethers.ZeroAddress);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "ActionProposed");
      await ac.connect(superAdmin2).coSignPlatformAction(ev!.args.actionId);

      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      await expect(
        ac.connect(superAdmin).proposePrivilegedGrant(ADMIN_ROLE, admin.address, ts + 86400)
      ).to.be.revertedWithCustomError(ac, "EnforcedPause");
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
