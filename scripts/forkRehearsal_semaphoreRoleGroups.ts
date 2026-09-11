import { ethers, network } from "hardhat";
import * as fs from "fs";

/**
 * Proves SemaphoreRoleGroups deploys and works end-to-end against a forked copy of live Sepolia
 * state -- including a full register -> sync -> generateProof -> verify (local + on-chain against
 * the REAL official Semaphore deployment) -- before spending real gas on the live deploy (T-015).
 *
 * Usage:
 *   HARDHAT_FORK_URL=<sepolia rpc url> \
 *   TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/forkRehearsal_semaphoreRoleGroups.ts --network hardhat
 */
async function main() {
  const deployment = JSON.parse(fs.readFileSync("deployments/sepolia.json", "utf-8"));
  const OFFICIAL_SEMAPHORE_SEPOLIA = "0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D";

  const Shivansh = "0x38c10EAEb7BF06ECC0c5273533465E85717C3E38";
  await network.provider.request({ method: "hardhat_impersonateAccount", params: [Shivansh] });
  await network.provider.send("hardhat_setBalance", [Shivansh, "0x56BC75E2D63100000"]);
  const signer = await ethers.getSigner(Shivansh);

  console.log("accessControl:", deployment.contracts.accessControl);
  console.log("official Semaphore (Sepolia):", OFFICIAL_SEMAPHORE_SEPOLIA);

  // Confirm the official contract really has code on this fork (i.e. the fork actually forked
  // from Sepolia, not an empty local chain).
  const code = await ethers.provider.getCode(OFFICIAL_SEMAPHORE_SEPOLIA);
  if (code === "0x") throw new Error("STOP: no code at the official Semaphore address on this fork -- is HARDHAT_FORK_URL set correctly?");
  console.log("✓ official Semaphore contract confirmed present on fork, code size:", (code.length - 2) / 2, "bytes");

  // Deploy SemaphoreRoleGroups against the REAL official Semaphore deployment.
  const Factory = await ethers.getContractFactory("SemaphoreRoleGroups", signer);
  const src = await Factory.deploy(deployment.contracts.accessControl, OFFICIAL_SEMAPHORE_SEPOLIA);
  await src.waitForDeployment();
  const srcAddr = await src.getAddress();
  console.log("✓ SemaphoreRoleGroups deployed:", srcAddr);

  const ac = await ethers.getContractAt("TimeBoundAccessControl", deployment.contracts.accessControl);
  const MANAGER_ROLE = await ac.MANAGER_ROLE();
  const groupId = await src.groupIdOf(MANAGER_ROLE);
  console.log("✓ MANAGER_ROLE groupId:", groupId.toString());

  // Grant MANAGER_ROLE to a fresh test signer on the fork (via the real ADMIN_ROLE->MANAGER_ROLE
  // hierarchy) so there's a real role holder to sync/prove with.
  const [, , testUser] = await ethers.getSigners();
  const ADMIN_ROLE = await ac.ADMIN_ROLE();
  const farFuture = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  // Shivansh holds DEFAULT_ADMIN_ROLE (T-020), which is NOT the admin of ADMIN_ROLE (SUPER_ADMIN_ROLE
  // is) -- grant via whichever address on this fork actually holds SUPER_ADMIN_ROLE. Rudra does.
  const Rudra = "0xb28EBde85D12Fd402ff8Daa7CFE1C84Bc449AD88";
  await network.provider.request({ method: "hardhat_impersonateAccount", params: [Rudra] });
  await network.provider.send("hardhat_setBalance", [Rudra, "0x56BC75E2D63100000"]);
  const rudraSigner = await ethers.getSigner(Rudra);
  await ac.connect(rudraSigner).grantTimedRole(ADMIN_ROLE, signer.address, farFuture); // Shivansh gets ADMIN_ROLE
  await ac.connect(signer).grantTimedRole(MANAGER_ROLE, testUser.address, farFuture);
  console.log("✓ MANAGER_ROLE granted to test user:", testUser.address);

  // Fund the test user (fork-only) and run the real register -> sync -> prove -> verify cycle.
  await network.provider.send("hardhat_setBalance", [testUser.address, "0x56BC75E2D63100000"]);

  const { Identity } = await import("@semaphore-protocol/identity");
  const { Group } = await import("@semaphore-protocol/group");
  const { generateProof, verifyProof } = await import("@semaphore-protocol/proof");

  const identity = new Identity();
  await src.connect(testUser).registerCommitment(identity.commitment);
  console.log("✓ commitment registered");

  await src.connect(testUser).syncMember(MANAGER_ROLE, testUser.address);
  console.log("✓ synced into MANAGER_ROLE group");

  const group = new Group([identity.commitment]);
  const proof = await generateProof(identity, group, "praman-setu-role-proof", MANAGER_ROLE);
  console.log("✓ real proof generated (circuit artifacts downloaded + used)");

  const localValid = await verifyProof(proof);
  console.log("✓ local (off-chain) verification:", localValid);
  if (!localValid) throw new Error("STOP: local proof verification failed");

  const semaphore = await ethers.getContractAt("ISemaphore", OFFICIAL_SEMAPHORE_SEPOLIA);
  const onchainProof = {
    merkleTreeDepth: proof.merkleTreeDepth,
    merkleTreeRoot: proof.merkleTreeRoot,
    nullifier: proof.nullifier,
    message: proof.message,
    scope: proof.scope,
    points: proof.points,
  };
  const onchainValid = await semaphore.verifyProof(groupId, onchainProof);
  console.log("✓ on-chain verification against the REAL official Semaphore contract:", onchainValid);
  if (!onchainValid) throw new Error("STOP: on-chain proof verification failed");

  console.log("\n═══ Fork rehearsal PASSED — SemaphoreRoleGroups is safe to deploy on live Sepolia ═══");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
