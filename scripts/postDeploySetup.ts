import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

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

  // 1. Enroll second SUPER_ADMIN via grantTimedRole (since deployer has DEFAULT_ADMIN_ROLE)
  const tbacAddress = deployments.contracts.accessControl;
  const tbac = await ethers.getContractAt("TimeBoundAccessControl", tbacAddress);
  const SUPER_ADMIN_ROLE = await tbac.SUPER_ADMIN_ROLE();
  
  const expiry = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year
  
  console.log("Granting SUPER_ADMIN_ROLE to 2nd admin...");
  const tx1 = await tbac.connect(deployer).grantTimedRole(SUPER_ADMIN_ROLE, secondAdmin.address, expiry);
  await tx1.wait();
  console.log("Granted!");

  // 2. Revoke deployer SUPER_ADMIN via a co-signed platform action
  // actionType: 1 = emergencyRevoke
  console.log("Proposing revocation of deployer's SUPER_ADMIN_ROLE...");
  const tx2 = await tbac.connect(deployer).proposePlatformAction(1, SUPER_ADMIN_ROLE, deployer.address);
  const receipt2 = await tx2.wait();
  
  const filter = tbac.filters.ActionProposed();
  // @ts-ignore
  const events = await tbac.queryFilter(filter, receipt2?.blockNumber, receipt2?.blockNumber);
  // find the event for our transaction
  const event = events.find((e: any) => e.transactionHash === receipt2?.hash);
  const actionId = (event as any).args.actionId;
  console.log(`ActionProposed: ${actionId}`);

  console.log("Co-signing revocation with 2nd admin...");
  const tbacSecondAdmin = tbac.connect(secondAdmin);
  const tx3 = await tbacSecondAdmin.coSignPlatformAction(actionId);
  await tx3.wait();
  console.log("Deployer SUPER_ADMIN_ROLE revoked via platform action!");

  // 3. Deploy ECDSASignatureVerifier
  console.log("Deploying ECDSASignatureVerifier...");
  const ECDSASignatureVerifier = await ethers.getContractFactory("ECDSASignatureVerifier");
  const verifier = await ECDSASignatureVerifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log(`ECDSASignatureVerifier deployed to: ${verifierAddress}`);

  deployments.contracts.ecdsaSignatureVerifier = verifierAddress;

  const didRegistry = await ethers.getContractAt("DIDRegistry", deployments.contracts.didRegistry);
  console.log("Setting signature verifier in DIDRegistry...");
  // But wait, the deployer just lost SUPER_ADMIN_ROLE. DIDRegistry requires DEFAULT_ADMIN_ROLE for setSignatureVerifier?
  // deployer STILL HAS DEFAULT_ADMIN_ROLE! We only revoked SUPER_ADMIN_ROLE!
  const tx4 = await didRegistry.connect(deployer).setSignatureVerifier(verifierAddress);
  await tx4.wait();
  console.log("Signature verifier set!");

  // 4. Grant ISSUER_ROLE to the credential issuer address (using deployer since DEFAULT_ADMIN_ROLE is admin for all)
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
