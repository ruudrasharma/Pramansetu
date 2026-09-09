import { NextRequest, NextResponse } from "next/server";

export interface AssetMetadata {
  name: string;
  description?: string;
  image?: string;
  clearanceLevel?: string;
  properties?: Record<string, any>;
}

/**
 * Server-side Pinata pin — generic JSON metadata upload, not asset-specific despite the
 * interface name below (kept for the asset-mint caller's existing shape). Also used by
 * didService.createDID to pin {name, department} onboarding metadata; only 'name' is
 * enforced here since callers pin genuinely different shapes. Runs only on the server so
 * PINATA_API_KEY / PINATA_SECRET_API_KEY (real secrets) never reach the browser bundle. If
 * the keys aren't configured, this fails loudly with a 500 and an explicit message — it
 * never returns a fake/mocked CID.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.PINATA_API_KEY;
  const apiSecret = process.env.PINATA_SECRET_API_KEY;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "PINATA_API_KEY / PINATA_SECRET_API_KEY are not configured on the server — set them in .env.local (see docs/ENVIRONMENT.md)." },
      { status: 500 }
    );
  }

  let metadata: AssetMetadata;
  try {
    metadata = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON metadata." }, { status: 400 });
  }

  if (!metadata?.name) {
    return NextResponse.json({ error: "Metadata requires at least a 'name' field." }, { status: 400 });
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
    return NextResponse.json({ error: "Failed to upload metadata to IPFS via Pinata." }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json({ cid: `ipfs://${data.IpfsHash}` });
}
