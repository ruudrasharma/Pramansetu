export interface AssetMetadata {
  name: string;
  description: string;
  image?: string;
  clearanceLevel?: string;
  properties?: Record<string, any>;
}

export async function uploadMetadataToIPFS(metadata: AssetMetadata): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY;
  const apiSecret = process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY;

  if (!apiKey || !apiSecret) {
    console.warn("Pinata keys not found in environment. Mocking IPFS upload.");
    // Wait for 1 second to simulate network latency
    await new Promise(resolve => setTimeout(resolve, 1000));
    return `ipfs://mocked-cid-${Date.now()}`;
  }

  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      pinata_api_key: apiKey,
      pinata_secret_api_key: apiSecret,
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Pinata Error:", errorText);
    throw new Error("Failed to upload metadata to IPFS via Pinata");
  }

  const data = await res.json();
  return `ipfs://${data.IpfsHash}`;
}
