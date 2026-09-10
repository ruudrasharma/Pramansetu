import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Proves the full TimeBoundAccessControl-upgrade + AssetRegistry-upgrade + OracleAttestation-
 * deploy + wiring sequence end-to-end against a forked copy of live Sepolia state, before touching
 * the real chain (T-016). Same impersonate-the-known-Super-Admin technique used for T-020's fork
 * rehearsal earlier this session -- no real private keys are used or needed, since both Super
 * Admin accounts are impersonated on the fork.
 *
 * Usage:
 *   HARDHAT_FORK_URL=<sepolia rpc url> \
 *   TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/forkRehearsal_oracleAttestation.ts --network hardhat
 *
 * Safe to re-run any number of times -- every state change happens only on the disposable in-memory
 * fork, never on real Sepolia. Re-run this immediately before the real live execution too: fork
 * state can drift if unrelated transactions land on live Sepolia in between the first rehearsal and
 * the real broadcast.
 */
async function main() {
  const deployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../deployments/sepolia.json"), "utf-8")
  );

  // The two real, live SUPER_ADMIN_ROLE holders as of T-020 (this session) -- Rudra and Shivansh.
  const SUPER_ADMIN_A = "0xb28EBde85D12Fd402ff8Daa7CFE1C84Bc449AD88";
  const SUPER_ADMIN_B = "0x38c10EAEb7BF06ECC0c5273533465E85717C3E38";

  for (const addr of [SUPER_ADMIN_A, SUPER_ADMIN_B]) {
    await network.provider.request({ method: "hardhat_impersonateAccount", params: [addr] });
    await network.provider.send("hardhat_setBalance", [addr, "0x56BC75E2D63100000"]); // 100 ETH, fork-only
  }
  const signerA = await ethers.getSigner(SUPER_ADMIN_A);
  const signerB = await ethers.getSigner(SUPER_ADMIN_B);

  const ac = await ethers.getContractAt("TimeBoundAccessControl", deployment.contracts.accessControl, signerA);
  const ar = await ethers.getContractAt("AssetRegistry", deployment.contracts.assetRegistry, signerA);

  const SUPER_ADMIN_ROLE = await ac.SUPER_ADMIN_ROLE();
  const ADMIN_ROLE = await ac.ADMIN_ROLE();
  const MANAGER_ROLE = await ac.MANAGER_ROLE();
  const AUDITOR_ROLE = await ac.AUDITOR_ROLE();

  console.log("accessControl:", deployment.contracts.accessControl);
  console.log("assetRegistry:", deployment.contracts.assetRegistry);
  console.log("Super Admin A (Rudra):", SUPER_ADMIN_A);
  console.log("Super Admin B (Shivansh):", SUPER_ADMIN_B);

  async function proposeAndCoSign(actionType: number, account: string): Promise<void> {
    const tx = await ac.connect(signerA).proposePlatformAction(actionType, ethers.ZeroHash, account);
    const r = await tx.wait();
    const ev = r!.logs
      .map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
      .find((e) => e?.name === "ActionProposed");
    await ac.connect(signerB).coSignPlatformAction(ev!.args.actionId);
  }

  // ── 1. TimeBoundAccessControl upgrade + ORACLE_ATTESTOR_ROLE reinitializer ──────────────────
  const NewTBAC = await ethers.getContractFactory("TimeBoundAccessControl", signerA);
  const newTbacImpl = await NewTBAC.deploy();
  await newTbacImpl.waitForDeployment();
  const newTbacImplAddr = await newTbacImpl.getAddress();
  await proposeAndCoSign(4, newTbacImplAddr);
  const initCalldata = ac.interface.encodeFunctionData("initializeOracleAttestorRole");
  await ac.connect(signerA).upgradeToAndCall(newTbacImplAddr, initCalldata);
  const roleAdmin = await ac.getRoleAdmin(await ac.ORACLE_ATTESTOR_ROLE());
  if (roleAdmin !== SUPER_ADMIN_ROLE) throw new Error("ORACLE_ATTESTOR_ROLE admin not set correctly after upgrade");
  console.log("✓ TimeBoundAccessControl upgraded, ORACLE_ATTESTOR_ROLE admin = SUPER_ADMIN_ROLE");

  // ── 2. AssetRegistry upgrade ─────────────────────────────────────────────────────────────────
  const NewAR = await ethers.getContractFactory("AssetRegistry", signerA);
  const newArImpl = await NewAR.deploy();
  await newArImpl.waitForDeployment();
  const newArImplAddr = await newArImpl.getAddress();
  await proposeAndCoSign(4, newArImplAddr);
  await ar.connect(signerA).upgradeToAndCall(newArImplAddr, "0x");
  console.log("✓ AssetRegistry upgraded");

  // ── 3. Deploy + wire OracleAttestation ───────────────────────────────────────────────────────
  const OA = await ethers.getContractFactory("OracleAttestation", signerA);
  const oa = await OA.deploy(deployment.contracts.accessControl, deployment.contracts.assetRegistry);
  await oa.waitForDeployment();
  const oaAddr = await oa.getAddress();
  await proposeAndCoSign(7, oaAddr);
  await ar.connect(signerA).setOracleAttestationContract(oaAddr);
  const wired = await ar.oracleAttestation();
  if (wired.toLowerCase() !== oaAddr.toLowerCase()) throw new Error("OracleAttestation not wired correctly");
  console.log("✓ OracleAttestation deployed and wired:", oaAddr);

  // ── 4. Mint a fork-only test token (live AssetRegistry has zero real mints as of T-016) ───────
  const [, , , attestor1, attestor2, auditor, recipient] = await ethers.getSigners();
  const farFuture = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  await ac.connect(signerA).grantTimedRole(ADMIN_ROLE, signerA.address, farFuture);
  await ac.connect(signerA).grantTimedRole(MANAGER_ROLE, signerB.address, farFuture);
  const proposeTx = await ar.connect(signerA).proposeMint(
    "bafybeigtest-rehearsal",
    ethers.keccak256(ethers.toUtf8Bytes("rehearsal-did")),
    recipient.address
  );
  const proposeReceipt = await proposeTx.wait();
  const mintEv = proposeReceipt!.logs
    .map((l) => { try { return ar.interface.parseLog(l as any); } catch { return null; } })
    .find((e) => e?.name === "MintProposed");
  const mintTx = await ar.connect(signerB).coSignMint(mintEv!.args.requestId);
  const mintReceipt = await mintTx.wait();
  const mintedEv = mintReceipt!.logs
    .map((l) => { try { return ar.interface.parseLog(l as any); } catch { return null; } })
    .find((e) => e?.name === "AssetMinted");
  const tokenId = mintedEv!.args.tokenId;
  console.log("✓ Fork-only test token minted, tokenId:", tokenId.toString());

  // ── 5. Grant ORACLE_ATTESTOR_ROLE + AUDITOR_ROLE, run a full fact lifecycle ────────────────────
  await ac.connect(signerA).grantTimedRole(await ac.ORACLE_ATTESTOR_ROLE(), attestor1.address, farFuture);
  await ac.connect(signerA).grantTimedRole(await ac.ORACLE_ATTESTOR_ROLE(), attestor2.address, farFuture);
  await ac.connect(signerA).grantTimedRole(AUDITOR_ROLE, auditor.address, farFuture);

  const dataHash = ethers.keccak256(ethers.toUtf8Bytes("delivery-proof"));
  const submitTx = await oa.connect(attestor1).submitFact(tokenId, 1, dataHash);
  const submitReceipt = await submitTx.wait();
  const factEv = submitReceipt!.logs
    .map((l) => { try { return oa.interface.parseLog(l as any); } catch { return null; } })
    .find((e) => e?.name === "FactSubmitted");
  const factId = factEv!.args.factId;
  await oa.connect(attestor2).attestFact(factId);
  console.log("✓ Fact submitted + attested (2-of-N), factId:", factId.toString());

  await network.provider.send("evm_increaseTime", [15 * 60 + 1]);
  await network.provider.send("evm_mine", []);
  await oa.finalize(factId);

  const recorded = await ar.oracleFactsOf(tokenId, 0);
  const latest = await ar.latestOracleFactType(tokenId);
  if (recorded.dataHash !== dataHash || latest !== 1n) {
    throw new Error(
      `Finalized fact was not recorded correctly on AssetRegistry: dataHash=${recorded.dataHash} (expected ${dataHash}), latestOracleFactType=${latest} (expected 1)`
    );
  }
  console.log("✓ Finalized fact recorded on AssetRegistry:", {
    factType: recorded.factType.toString(),
    dataHash: recorded.dataHash,
    factId: recorded.factId.toString(),
  });

  console.log("\n═══ Fork rehearsal PASSED — sequence is safe to replay on live Sepolia ═══");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
