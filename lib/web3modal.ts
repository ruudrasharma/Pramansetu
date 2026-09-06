import { createWeb3Modal } from "@web3modal/wagmi/react";
import { wagmiConfig } from "./wagmi";

// Setup queryClient (reused from Web3Providers)
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "00000000000000000000000000000000";

if (!projectId) {
  console.warn("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set in .env.local");
}

export const web3Modal = createWeb3Modal({
  wagmiConfig,
  projectId,
  enableAnalytics: false,
  enableOnramp: false,
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "var(--brand-bel)", // use the brand color defined in our CSS
    "--w3m-border-radius-master": "1px",
    "--w3m-font-family": "var(--font-inter)",
  },
});
