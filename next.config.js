/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "**.ipfs.w3s.link" }] },

  /**
   * Webpack aliases to stub transitive deps that are pulled in by wagmi's
   * baseAccount connector (via @wagmi/connectors → @base-org/account →
   * @coinbase/cdp-sdk → @x402/evm) but are never used by this project.
   * Stubbing them with `false` tells webpack to emit an empty module instead
   * of failing the build. This is safe because:
   *   1. We don't import any Coinbase/Base connector in lib/wagmi.ts
   *   2. The CDP SDK is only loaded lazily by the connector, so stubbing its
   *      optional dep doesn't break anything we actually call.
   */
  webpack(config) {
    // Stub the entire Coinbase/x402 transitive dependency chain pulled in by
    // wagmi's baseAccount connector. We use only injected() and walletConnect(),
    // so none of this code is ever executed — but webpack still tries to resolve it.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/evm": false,
      "@x402/svm/exact/client": false,
      "@x402/svm": false,
      "@coinbase/cdp-sdk": false,
    };
    return config;
  },
};

module.exports = nextConfig;
