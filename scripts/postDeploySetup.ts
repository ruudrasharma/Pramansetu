import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * postDeploySetup.ts — TODO.md §3.2/§3.3 (audit §2.3/§2.5) reordering note:
 *
 * setGuardianRecoveryContract and setSignatureVerifier now need 2-of-N SUPER_ADMIN_ROLE approval
 * (propose via proposePlatformAction, then a second signer co-signs) instead of the old
 * single-signer `onlyOwner`/`hasRole` gates. That approval needs TWO real SUPER_ADMIN signers, so
 * every step that needs it must run BEFORE the deployer's SUPER_ADMIN_ROLE is revoked below —
 * revocation is deliberately the last privileged step in this script, not the second one anymore.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Executing post-deploy setup with deployer: ${deployer.address}`);

  const deploymentsPath = path.join(__dirname, "../deployments/sepolia.json");
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error("deployments/sepolia.json not found");
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));

  // Create a second SUPER_ADMIN mock wallet for demo
  const secondAdmin = ethers.Wallet.createRandom().connect(ethers.provider);
  console.log(`Generated 2nd SUPER_ADMIN wallet: ${secondAdmin.address}`);
  console.log(`Private Key: ${secondAdmin.privateKey}`);
  
  // Need to fund the second admin slightly so it can co-sign
  const txFund = await deployer.sendTransaction({
    to: secondAdmin.address,
    value: ethers.parseEther("0.005"),
  });
  await txFund.wait();
  console.log("Funded 2nd SUPER_ADMIN with 0.005 ETH");

  // 1. Enroll second SUPER_ADMIN via grantTimedRole (since deployer has DEFAULT_ADMIN_ROLE) —
  // single-signer bootstrap step, same precedent as the live T-020 grant. This is the ONLY
  // privileged step in this script that doesn't need a second signer, because it's what CREATES
  // the second signer everything after it depends on.
  const tbacAddress = deployments.contracts.accessControl;
  const tbac = await ethers.getContractAt("TimeBoundAccessControl", tbacAddress);
  const SUPER_ADMIN_ROLE = await tbac.SUPER_ADMIN_ROLE();

  const expiry = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year

  console.log("Granting SUPER_ADMIN_ROLE to 2nd admin...");
  const tx1 = await tbac.connect(deployer).grantTimedRole(SUPER_ADMIN_ROLE, secondAdmin.address, expiry);
  await tx1.wait();
  console.log("Granted!");

  /** Proposes (as deployer) + co-signs (as secondAdmin) a TimeBoundAccessControl platform action
   *  and returns the real actionId — shared helper for the three 2-of-N steps below (§3.1/§3.2's
   *  propose/co-sign pattern). Both signers are needed while the deployer still holds
   *  SUPER_ADMIN_ROLE, which is why steps 2/3 below must run before step 4 revokes it. */
  async function proposeAndCoSign(actionType: number, role: string, account: string) {
    const proposeTx = await tbac.connect(deployer).proposePlatformAction(actionType, role, account);
    const receipt = await proposeTx.wait();
    const filter = tbac.filters.ActionProposed();
    // @ts-ignore
    const events = await tbac.queryFilter(filter, receipt?.blockNumber, receipt?.blockNumber);
    const event = events.find((e: any) => e.transactionHash === receipt?.hash);
    const actionId = (event as any).args.actionId;
    await (await tbac.connect(secondAdmin).coSignPlatformAction(actionId)).wait();
    return actionId;
  }

  const ZERO_ROLE = ethers.ZeroHash;
  const didRegistry = await ethers.getContractAt("DIDRegistry", deployments.contracts.didRegistry);

  // 2. Wire GuardianRecovery into DIDRegistry — actionType 6 (authorizeDIDGuardianRecovery, §3.2).
  //    Was a direct deployer-only call in deploy.ts before this fix; now needs 2-of-N approval,
  //    so it happens here instead, right after the second SUPER_ADMIN exists.
  console.log("Authorizing GuardianRecovery on TimeBoundAccessControl (2-of-N)...");
  await proposeAndCoSign(6, ZERO_ROLE, deployments.contracts.guardianRecovery);
  console.log("Wiring GuardianRecovery into DIDRegistry...");
  await (await didRegistry.connect(deployer).setGuardianRecoveryContract(deployments.contracts.guardianRecovery)).wait();
  console.log("GuardianRecovery wired!");

  // 3. Deploy ECDSASignatureVerifier, authorize it (actionType 5, §3.2), then set it.
  console.log("Deploying ECDSASignatureVerifier...");
  const ECDSASignatureVerifier = await ethers.getContractFactory("ECDSASignatureVerifier");
  const verifier = await ECDSASignatureVerifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log(`ECDSASignatureVerifier deployed to: ${verifierAddress}`);

  deployments.contracts.ecdsaSignatureVerifier = verifierAddress;

  console.log("Authorizing signature verifier on TimeBoundAccessControl (2-of-N)...");
  await proposeAndCoSign(5, ZERO_ROLE, verifierAddress);
  console.log("Setting signature verifier in DIDRegistry...");
  const tx4 = await didRegistry.connect(deployer).setSignatureVerifier(verifierAddress);
  await tx4.wait();
  console.log("Signature verifier set!");

  // 4. Revoke deployer SUPER_ADMIN via a co-signed platform action — actionType 1
  // (emergencyRevoke). Deliberately LAST: steps 2-3 above still needed the deployer as one of
  // the two SUPER_ADMIN signers.
  console.log("Proposing revocation of deployer's SUPER_ADMIN_ROLE...");
  await proposeAndCoSign(1, SUPER_ADMIN_ROLE, deployer.address);
  console.log("Deployer SUPER_ADMIN_ROLE revoked via platform action!");

  // 5. Grant ISSUER_ROLE to the credential issuer address (using deployer since DEFAULT_ADMIN_ROLE is admin for all)
  const credRegistry = await ethers.getContractAt("CredentialRegistry", deployments.contracts.credentialRegistry);
  const ISSUER_ROLE = await credRegistry.ISSUER_ROLE();
  
  // Create a mock issuer wallet
  const issuerWallet = ethers.Wallet.createRandom().connect(ethers.provider);
  console.log(`Generated Mock ISSUER wallet: ${issuerWallet.address}`);
  console.log(`Private Key: ${issuerWallet.privateKey}`);
  
  deployments.mockWallets = {
    secondSuperAdmin: { address: secondAdmin.address, privateKey: secondAdmin.privateKey },
    issuer: { address: issuerWallet.address, privateKey: issuerWallet.privateKey },
  };

  console.log("Granting ISSUER_ROLE...");
  // CredentialRegistry inherits AccessControlUpgradeable. DEFAULT_ADMIN_ROLE can grant ISSUER_ROLE.
  const tx5 = await credRegistry.connect(deployer).grantRole(ISSUER_ROLE, issuerWallet.address);
  await tx5.wait();
  console.log("ISSUER_ROLE granted!");

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("Setup complete. Updated deployments/sepolia.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
