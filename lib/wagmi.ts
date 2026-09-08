import { http, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

/**
 * Scaffold only — pages currently read from lib/mock-data.ts (see TODO.md "Blocking" items).
 * Once contracts are deployed (docs/DEPLOYMENT.md §3) and addresses are in .env.local
 * (docs/ENVIRONMENT.md), replace mock-data reads with wagmi's `useReadContract` /
 * `useWriteContract` hooks against the ABIs in `lib/abis/`.
 */
export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
    }),
  ],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
});

export const contractAddresses = {
  didRegistry: process.env.NEXT_PUBLIC_DID_REGISTRY_ADDRESS as `0x${string}` | undefined,
  credentialRegistry: process.env.NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS as `0x${string}` | undefined,
  accessControl: process.env.NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS as `0x${string}` | undefined,
  assetRegistry: process.env.NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS as `0x${string}` | undefined,
  guardianRecovery: process.env.NEXT_PUBLIC_GUARDIAN_RECOVERY_ADDRESS as `0x${string}` | undefined,
  governanceTimelock: process.env.NEXT_PUBLIC_GOVERNANCE_TIMELOCK_ADDRESS as `0x${string}` | undefined,
};
