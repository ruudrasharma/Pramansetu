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
      // 4 (authorizeUpgrade, T-3.1), 5/6 (DIDRegistry owner-equivalent actions, T-3.2), and 7
      // (authorizeOracleAttestationContract, T-016) are all valid now — 8 is the first invalid value.
      await expect(
        ac.connect(superAdmin).proposePlatformAction(8, ethers.ZeroHash, ethers.ZeroAddress)
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

  // ── UUPS upgrade auth — 2-of-N via proposePlatformAction(4,...)/coSignPlatformAction ────
  // Audit §2.2 / TODO.md §3.1: _authorizeUpgrade used to be onlyRole(SUPER_ADMIN_ROLE) — one
  // signer. These tests cover the fix and, specifically, the failure mode it closes: a single
  // SUPER_ADMIN alone can no longer push an upgrade.

  describe("UUPS upgrade authorization (2-of-N)", () => {
    async function deployNewImplementation() {
      const Factory = await ethers.getContractFactory("TimeBoundAccessControl");
      const impl = await Factory.deploy();
      await impl.waitForDeployment();
      return impl.getAddress();
    }

    async function proposeAndApprove(newImpl: string) {
      const tx = await ac.connect(superAdmin).proposePlatformAction(4, ethers.ZeroHash, newImpl);
      const r = await tx.wait();
      const ev = r!.logs
        .map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "ActionProposed");
      await ac.connect(superAdmin2).coSignPlatformAction(ev!.args.actionId);
    }

    it("closes the single-signer hole: one SUPER_ADMIN alone can no longer authorize an upgrade", async () => {
      const newImpl = await deployNewImplementation();
      // No proposePlatformAction(4,...)/coSign at all — a lone SUPER_ADMIN calling the real
      // UUPS entry point directly must now be rejected, where the old onlyRole(SUPER_ADMIN_ROLE)
      // gate would have let this through.
      await expect(
        ac.connect(superAdmin).upgradeToAndCall(newImpl, "0x")
      ).to.be.revertedWithCustomError(ac, "UpgradeNotAuthorized");
    });

    it("sets upgradeAuthorized once 2 distinct SUPER_ADMINs propose+co-sign actionType=4", async () => {
      const newImpl = await deployNewImplementation();
      expect(await ac.upgradeAuthorized(newImpl)).to.be.false;
      await proposeAndApprove(newImpl);
      expect(await ac.upgradeAuthorized(newImpl)).to.be.true;
    });

    it("upgrade succeeds once the exact implementation address has 2-of-N approval", async () => {
      const newImpl = await deployNewImplementation();
      await proposeAndApprove(newImpl);
      await expect(ac.connect(superAdmin).upgradeToAndCall(newImpl, "0x")).to.not.be.reverted;
    });

    it("execution is permissionless once approved, matching this app's own approve-then-anyone-executes pattern", async () => {
      const newImpl = await deployNewImplementation();
      await proposeAndApprove(newImpl);
      await expect(ac.connect(stranger).upgradeToAndCall(newImpl, "0x")).to.not.be.reverted;
    });

    it("consumes the approval on use — the same implementation address needs fresh approval to be re-authorized", async () => {
      const newImpl = await deployNewImplementation();
      await proposeAndApprove(newImpl);
      await ac.connect(superAdmin).upgradeToAndCall(newImpl, "0x");
      expect(await ac.upgradeAuthorized(newImpl)).to.be.false;

      await expect(
        ac.connect(superAdmin).upgradeToAndCall(newImpl, "0x")
      ).to.be.revertedWithCustomError(ac, "UpgradeNotAuthorized");
    });

    it("consumeUpgradeAuthorization lets anyone clear a pending approval (documented griefing tradeoff, not a privilege escalation)", async () => {
      const newImpl = await deployNewImplementation();
      await proposeAndApprove(newImpl);
      expect(await ac.upgradeAuthorized(newImpl)).to.be.true;

      await ac.connect(stranger).consumeUpgradeAuthorization(newImpl);
      expect(await ac.upgradeAuthorized(newImpl)).to.be.false;

      await expect(
        ac.connect(superAdmin).upgradeToAndCall(newImpl, "0x")
      ).to.be.revertedWithCustomError(ac, "UpgradeNotAuthorized");
    });
  });

  // ── DIDRegistry owner-equivalent authorization (actionType 5/6, T-3.2) ─────
  // audit §2.3 / TODO.md §3.2: DIDRegistry.setSignatureVerifier/setGuardianRecoveryContract used
  // to be gated by a bare `owner` address. This contract now stages that approval the same way
  // it stages upgrade authorization — DIDRegistry itself (test/DIDRegistry.test.ts) checks and
  // consumes these flags; these tests cover the staging half that lives here.

  describe("DIDRegistry owner-equivalent authorization (actionType 5/6)", () => {
    async function proposeAndApprove(actionType: 5 | 6, target: string) {
      const tx = await ac.connect(superAdmin).proposePlatformAction(actionType, ethers.ZeroHash, target);
      const r = await tx.wait();
      const ev = r!.logs
        .map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "ActionProposed");
      await ac.connect(superAdmin2).coSignPlatformAction(ev!.args.actionId);
    }

    it("actionType=5 sets didSignatureVerifierAuthorized once 2-of-N approve", async () => {
      const verifier = ethers.Wallet.createRandom().address;
      expect(await ac.didSignatureVerifierAuthorized(verifier)).to.be.false;
      await proposeAndApprove(5, verifier);
      expect(await ac.didSignatureVerifierAuthorized(verifier)).to.be.true;
    });

    it("actionType=6 sets didGuardianRecoveryAuthorized once 2-of-N approve", async () => {
      const recovery = ethers.Wallet.createRandom().address;
      expect(await ac.didGuardianRecoveryAuthorized(recovery)).to.be.false;
      await proposeAndApprove(6, recovery);
      expect(await ac.didGuardianRecoveryAuthorized(recovery)).to.be.true;
    });

    it("consumeDIDSignatureVerifierAuthorization/consumeDIDGuardianRecoveryAuthorization clear the flags", async () => {
      const verifier = ethers.Wallet.createRandom().address;
      const recovery = ethers.Wallet.createRandom().address;
      await proposeAndApprove(5, verifier);
      await proposeAndApprove(6, recovery);

      await ac.connect(stranger).consumeDIDSignatureVerifierAuthorization(verifier);
      await ac.connect(stranger).consumeDIDGuardianRecoveryAuthorization(recovery);

      expect(await ac.didSignatureVerifierAuthorized(verifier)).to.be.false;
      expect(await ac.didGuardianRecoveryAuthorized(recovery)).to.be.false;
    });
  });
});
