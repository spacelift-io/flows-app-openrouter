import { createHmac } from "crypto";

export function generateFlowSecret(
  blockId: string,
  appSecretKey: string,
): string {
  // Generate a deterministic secret from block ID using app's secret key
  return createHmac("sha256", appSecretKey).update(blockId).digest("hex");
}

export function signRequest(
  body: string,
  timestamp: number,
  flowSecret: string,
): string {
  const data = body + timestamp.toString();
  return createHmac("sha256", flowSecret).update(data).digest("hex");
}
