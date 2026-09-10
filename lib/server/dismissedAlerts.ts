import { promises as fs } from "fs";
import path from "path";

/**
 * Minimal server-side persistence for dismissed anomaly alerts (TODO.md T-036).
 * Anomaly ids are deterministic (see app/api/audit/anomalies/route.ts — derived from the
 * source event id / actor+timestamp), so recording a dismissed id here survives the anomaly
 * route recomputing the same alert on every poll. A JSON file is enough for this project's
 * scope — this is the only mutable off-chain state the platform has, everything else is
 * either on-chain or re-derived from the subgraph.
 */

interface DismissedRecord {
  reason: string;
  dismissedAt: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "dismissed-alerts.json");

async function readStore(): Promise<Record<string, DismissedRecord>> {
  try {
    const raw = await fs.readFile(FILE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err: any) {
    if (err?.code === "ENOENT") return {};
    throw err;
  }
}

async function writeStore(store: Record<string, DismissedRecord>): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export async function getDismissedAlerts(): Promise<Record<string, DismissedRecord>> {
  return readStore();
}

export async function dismissAlert(alertId: string, reason: string): Promise<void> {
  const store = await readStore();
  store[alertId] = { reason, dismissedAt: Date.now() };
  await writeStore(store);
}
