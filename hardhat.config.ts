import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// ts-node needs commonjs + node resolution to work with Hardhat; the main tsconfig.json uses
// "bundler" moduleResolution for Next.js which breaks ts-node. This override resolves that.
// See tsconfig.hardhat.json.


const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "11".repeat(32);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    // HARDHAT_FORK_URL, when set, forks the given RPC (e.g. live Sepolia) for the local `hardhat`
    // network instead of starting from a clean chain -- used by scripts/forkRehearsal_*.ts to
    // rehearse a real transaction sequence against real live state (via account impersonation, no
    // private keys needed) before ever broadcasting it for real. Unset by default so every other
    // use of the `hardhat` network (unit tests, etc.) is unaffected.
    hardhat: process.env.HARDHAT_FORK_URL
      ? { forking: { url: process.env.HARDHAT_FORK_URL } }
      : {},
    amoy: {
      url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 80002,
    },
    sepolia: {
      url: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://rpc2.sepolia.org",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
};

export default config;
