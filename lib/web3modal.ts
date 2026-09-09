import { createWeb3Modal } from "@web3modal/wagmi/react";
import { wagmiConfig } from "./wagmi";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Previously this silently fell back to a garbage all-zeros project ID when unset, which
// initialized Web3Modal in a way that looks wired up but makes wallet connection fail with no
// clear explanation. Fail loudly instead: skip initialization entirely and let the UI (the
// <w3m-button/> in ContextBar.tsx renders nothing useful without a real modal) make the missing
// config visible, plus a clear console error for whoever's debugging it.
export const web3ModalConfigured = !!projectId;

if (!projectId) {
  console.error(
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set — wallet connection is disabled. Set it in .env.local (see docs/ENVIRONMENT.md)."
  );
} else {
  createWeb3Modal({
    wagmiConfig,
    projectId,
    enableAnalytics: false,
    enableOnramp: false,
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "var(--brand-praman-setu)", // use the brand color defined in our CSS
      "--w3m-border-radius-master": "1px",
      "--w3m-font-family": "var(--font-inter)",
    },
  });
}
