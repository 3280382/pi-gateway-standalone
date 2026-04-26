/**
 * Extract a short 8-character session ID from a session file path or filename.
 *
 * Session file format: <ISO-timestamp>_<UUIDv7>.jsonl
 *   e.g. "2026-04-26T05-00-13-601Z_019dc828-d9a1-77fa-a765-61dc5428beb9.jsonl"
 *
 * UUIDv7 has timestamp at the front, randomness at the end.
 * We take the LAST 8 hex chars (sans hyphens) to avoid collisions.
 */
export function extractShortSessionId(sessionFile: string): string {
  if (!sessionFile) return "";
  const fileName = sessionFile.split("/").pop() || "";
  const withoutExt = fileName.replace(".jsonl", "");
  const parts = withoutExt.split("_");
  const uuidPart = parts[parts.length - 1] || fileName;
  const clean = uuidPart.replace(/-/g, "");
  return clean.slice(-8).padStart(8, "0");
}
