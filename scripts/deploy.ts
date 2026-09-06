import { ethers, upgrades } from "hardhat";
import * as fs from "fs";

/**
 * Deploys the full BEL Chain contract set to whichever network is passed via --network.
 * Order matters: DIDRegistry and CredentialRegistry are independent; TimeBoundAccessControl
 * (proxy) needs no prior deploys; AssetRegistry (proxy) needs AccessControl + CredentialRegistry;
 * GuardianRecovery needs DIDRegistry; GovernanceTimelock needs AccessControl.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const DIDRegistry = await ethers.getContractFactory("DIDRegistry");
  const didRegistry = await DIDRegistry.deploy();
  await didRegistry.waitForDeployment();
  console.log("DIDRegistry:", await didRegistry.getAddress());

  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
  const credentialRegistry = await CredentialRegistry.deploy(deployer.address);
  await credentialRegistry.waitForDeployment();
  console.log("CredentialRegistry:", await credentialRegistry.getAddress());

  const AccessControl = await ethers.getContractFactory("TimeBoundAccessControl");
  const accessControl = await upgrades.deployProxy(AccessControl, [deployer.address], {
    kind: "uups",
  });
  await accessControl.waitForDeployment();
  console.log("TimeBoundAccessControl (proxy):", await accessControl.getAddress());

  const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
  const assetRegistry = await upgrades.deployProxy(
    AssetRegistry,
    [await accessControl.getAddress(), await credentialRegistry.getAddress()],
    { kind: "uups" }
  );
  await assetRegistry.waitForDeployment();
  console.log("AssetRegistry (proxy):", await assetRegistry.getAddress());

  const GuardianRecovery = await ethers.getContractFactory("GuardianRecovery");
  const guardianRecovery = await GuardianRecovery.deploy(await didRegistry.getAddress());
  await guardianRecovery.waitForDeployment();
  console.log("GuardianRecovery:", await guardianRecovery.getAddress());
  await (await didRegistry.setGuardianRecoveryContract(await guardianRecovery.getAddress())).wait();

  const GovernanceTimelock = await ethers.getContractFactory("GovernanceTimelock");
  const governanceTimelock = await GovernanceTimelock.deploy(await accessControl.getAddress());
  await governanceTimelock.waitForDeployment();
  console.log("GovernanceTimelock:", await governanceTimelock.getAddress());

  const network = (await ethers.provider.getNetwork()).name || "unknown";
  const out = {
    network,
    didRegistry: await didRegistry.getAddress(),
    credentialRegistry: await credentialRegistry.getAddress(),
    accessControl: await accessControl.getAddress(),
    assetRegistry: await assetRegistry.getAddress(),
    guardianRecovery: await guardianRecovery.getAddress(),
    governanceTimelock: await governanceTimelock.getAddress(),
    deployedAt: new Date().toISOString(),
  };
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(`deployments/${network}.json`, JSON.stringify(out, null, 2));
  console.log("\nWritten to deployments/" + network + ".json — copy addresses into .env.local");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
