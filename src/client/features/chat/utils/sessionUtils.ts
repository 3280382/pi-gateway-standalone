/**
 * Session utility functions
 */

/**
 * Extract short session ID from session file path or full ID (fixed 8 characters)
 * Example: "/.../2026-04-17T08-26-10-585Z_019d9a8c-2b19-7345-94f5-5efedb498871.jsonl" -> "5efedb49"
 */
export function extractShortSessionId(sessionFile: string): string {
  if (!sessionFile) return "";
  const fileName = sessionFile.split("/").pop() || "";
  const withoutExt = fileName.replace(".jsonl", "");
  const parts = withoutExt.split("_");
  // Get UUID part (last segment after underscore) and take first 8 chars
  const uuidPart = parts[parts.length - 1] || fileName;
  return uuidPart.slice(0, 8);
}

/**
 * Format session ID for display (ensures 8 characters)
 */
export function formatSessionId(id: string | null | undefined): string {
  if (!id) return "";
  // If already 8 chars or less, return as-is
  if (id.length <= 8) return id;
  // Otherwise extract short ID
  return extractShortSessionId(id);
}
