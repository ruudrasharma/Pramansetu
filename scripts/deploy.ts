import { ethers, upgrades, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * deploy.ts — Production deployment script for Praman Setu (PS 26125).
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network sepolia
 *   npx hardhat run scripts/deploy.ts --network sepolia
 *
 * After deployment, copy the printed addresses into .env.local using the
 * NEXT_PUBLIC_* keys in .env.example. The script also writes
 * deployments/<network>.json as a permanent record (gitignored for secrets;
 * commit the JSON but NOT the private key).
 *
 * Bootstrap roles granted on deploy (can be changed via governance later):
 *   - deployer → SUPER_ADMIN_ROLE (bootstrap; transfer to hardware wallet)
 *   - deployer → DEFAULT_ADMIN_ROLE (OZ)
 *
 * SECURITY NOTE: This script sets the deployer as the first SUPER_ADMIN.
 * The post-deploy checklist in docs/DEPLOYMENT.md §4 requires:
 *   1. Enroll a second SUPER_ADMIN hardware wallet immediately after deploy.
 *   2. Revoke the deployer's SUPER_ADMIN and DEFAULT_ADMIN roles.
 *   3. Set signatureVerifier on DIDRegistry once deployed.
 *
 * TODO.md §3.2/§3.3 (audit §2.3/§2.5): DIDRegistry.setGuardianRecoveryContract/
 * setSignatureVerifier and GovernanceTimelock.queueTransaction now require 2-of-N
 * SUPER_ADMIN_ROLE approval via TimeBoundAccessControl's propose/co-sign flow instead of a
 * bare-address/single-signer gate. Only one real SUPER_ADMIN (the deployer) exists at the point
 * this script runs, so wiring GuardianRecovery into DIDRegistry — which needs that 2-of-N
 * approval — has moved to postDeploySetup.ts, run after a second SUPER_ADMIN is enrolled there.
 * DIDRegistry's constructor now also takes accessControlAddr (§3.2) — TimeBoundAccessControl
 * deploys first below, reordered from its previous position after DIDRegistry.
 */

async function verify(address: string, constructorArgs: unknown[]) {
  try {
    await run("verify:verify", { address, constructorArguments: constructorArgs });
    console.log(`  ✓ Verified ${address}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Already Verified")) {
      console.log(`  ↳ Already verified: ${address}`);
    } else {
      console.warn(`  ⚠ Verify failed (non-fatal): ${msg}`);
    }
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? `chain-${network.chainId}` : network.name;

  console.log(`\n═══ Praman Setu Deploy ═══`);
  console.log(`Network : ${networkName} (chainId ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} MATIC\n`);

  // ── 1. TimeBoundAccessControl (UUPS proxy) ───────────────────────────────────────
  // Deployed first (moved from step 3) — DIDRegistry's constructor now needs its address (§3.2).
  console.log("Deploying TimeBoundAccessControl (UUPS proxy)...");
  const AccessControl = await ethers.getContractFactory("TimeBoundAccessControl");
  const accessControl = await upgrades.deployProxy(AccessControl, [deployer.address], {
    kind: "uups",
    unsafeSkipStorageCheck: false, // enforce storage safety on mainnet
  });
  await accessControl.waitForDeployment();
  const accessControlAddr = await accessControl.getAddress();
  console.log(`  ✓ TimeBoundAccessControl (proxy): ${accessControlAddr}`);

  // ── 2. DIDRegistry (non-upgradeable — storage layout is a security boundary) ────
  // Constructor now takes accessControlAddr (§3.2, audit §2.3) — owner-equivalent authority for
  // setSignatureVerifier/setGuardianRecoveryContract routes through TimeBoundAccessControl's
  // 2-of-N SUPER_ADMIN_ROLE approval instead of a bare `owner` address.
  console.log("Deploying DIDRegistry...");
  const DIDRegistry = await ethers.getContractFactory("DIDRegistry");
  const didRegistry = await DIDRegistry.deploy(accessControlAddr);
  await didRegistry.waitForDeployment();
  const didRegistryAddr = await didRegistry.getAddress();
  console.log(`  ✓ DIDRegistry: ${didRegistryAddr}`);

  // ── 3. CredentialRegistry (non-upgradeable) ──────────────────────────────────────
  console.log("Deploying CredentialRegistry...");
  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
  const credentialRegistry = await CredentialRegistry.deploy(deployer.address);
  await credentialRegistry.waitForDeployment();
  const credRegistryAddr = await credentialRegistry.getAddress();
  console.log(`  ✓ CredentialRegistry: ${credRegistryAddr}`);

  // ── 4. AssetRegistry (UUPS proxy) ────────────────────────────────────────────────
  console.log("Deploying AssetRegistry (UUPS proxy)...");
  const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
  const assetRegistry = await upgrades.deployProxy(
    AssetRegistry,
    [accessControlAddr, credRegistryAddr],
    { kind: "uups", unsafeSkipStorageCheck: false }
  );
  await assetRegistry.waitForDeployment();
  const assetRegistryAddr = await assetRegistry.getAddress();
  console.log(`  ✓ AssetRegistry (proxy): ${assetRegistryAddr}`);

  // ── 5. GuardianRecovery ───────────────────────────────────────────────────────────
  console.log("Deploying GuardianRecovery...");
  const GuardianRecovery = await ethers.getContractFactory("GuardianRecovery");
  const guardianRecovery = await GuardianRecovery.deploy(didRegistryAddr);
  await guardianRecovery.waitForDeployment();
  const guardianRecoveryAddr = await guardianRecovery.getAddress();
  console.log(`  ✓ GuardianRecovery: ${guardianRecoveryAddr}`);

  // NOT wired into DIDRegistry here (see §3.2 note at the top of this file) —
  // didRegistry.setGuardianRecoveryContract now needs 2-of-N SUPER_ADMIN_ROLE approval, and only
  // one real SUPER_ADMIN (the deployer) exists at this point. postDeploySetup.ts does this wiring
  // right after it enrolls a second SUPER_ADMIN.

  // ── 6. GovernanceTimelock ──────────────────────────────────────────────────────────
  console.log("Deploying GovernanceTimelock...");
  const GovernanceTimelock = await ethers.getContractFactory("GovernanceTimelock");
  const governanceTimelock = await GovernanceTimelock.deploy(accessControlAddr);
  await governanceTimelock.waitForDeployment();
  const governanceTimelockAddr = await governanceTimelock.getAddress();
  console.log(`  ✓ GovernanceTimelock: ${governanceTimelockAddr}`);

  // ── 7. Write deployment record ────────────────────────────────────────────────────
  const deploymentRecord = {
    network: networkName,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      didRegistry:          didRegistryAddr,
      credentialRegistry:   credRegistryAddr,
      accessControl:        accessControlAddr,
      assetRegistry:        assetRegistryAddr,
      guardianRecovery:     guardianRecoveryAddr,
      governanceTimelock:   governanceTimelockAddr,
    },
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const outPath = path.join(deploymentsDir, `${networkName}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deploymentRecord, null, 2));

  console.log(`\n═══ Deployment complete ═══`);
  console.log(`Written: deployments/${networkName}.json`);
  console.log(`\nCopy to .env.local:\n`);
  console.log(`NEXT_PUBLIC_DID_REGISTRY_ADDRESS=${didRegistryAddr}`);
  console.log(`NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS=${credRegistryAddr}`);
  console.log(`NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS=${accessControlAddr}`);
  console.log(`NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS=${assetRegistryAddr}`);
  console.log(`NEXT_PUBLIC_GUARDIAN_RECOVERY_ADDRESS=${guardianRecoveryAddr}`);
  console.log(`NEXT_PUBLIC_GOVERNANCE_TIMELOCK_ADDRESS=${governanceTimelockAddr}`);

  // ── 8. Etherscan verification (best-effort; skip on localhost) ─────────────────
  if (networkName !== "hardhat" && networkName !== "localhost") {
    console.log("\n─── Verifying on Etherscan ───");
    await verify(didRegistryAddr, [accessControlAddr]);
    await verify(credRegistryAddr, [deployer.address]);
    await verify(guardianRecoveryAddr, [didRegistryAddr]);
    await verify(governanceTimelockAddr, [accessControlAddr]);
    // Proxy implementation addresses are auto-verified by hardhat-upgrades
  }

  console.log(`\n⚠  POST-DEPLOY CHECKLIST — run scripts/postDeploySetup.ts (see docs/DEPLOYMENT.md §4):`);
  console.log(`   1. Enroll second SUPER_ADMIN wallet via grantTimedRole (deployer's DEFAULT_ADMIN_ROLE)`);
  console.log(`   2. Wire GuardianRecovery into DIDRegistry (2-of-N: proposePlatformAction(6,...) + coSign)`);
  console.log(`   3. Deploy ECDSASignatureVerifier and authorize+set it on DIDRegistry (2-of-N: actionType 5)`);
  console.log(`   4. Revoke deployer SUPER_ADMIN_ROLE (2-of-N: proposePlatformAction(1,...) + coSign) — do this LAST,`);
  console.log(`      after steps 2-3, since those still need the deployer as one of the two signers`);
  console.log(`   5. Grant ISSUER_ROLE to the CredentialRegistry issuer address`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
