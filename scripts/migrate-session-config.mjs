#!/usr/bin/env node
/**
 * Migrate session-config.json from old format to new simplified format.
 *
 * OLD (per session):
 *   "shortId": {
 *     "shortId": "shortId",          // redundant: key is the shortId
 *     "fullPath": "...",             // KEEP: unique per session
 *     "workingDir": "...",           // redundant: all same in one file
 *     "name": "...",
 *     "summary": "...",              // REMOVE: not used
 *     "agentId": "...",
 *     "agentName": "...",
 *     "parentId": null,
 *     "childIds": [],
 *     "createdAt": "...",            // REMOVE: not used
 *     "updatedAt": "..."             // REMOVE: not used
 *   }
 *
 * NEW:
 *   "_meta": { "workingDir": "..." }
 *   "shortId": {
 *     "fullPath": "...",             // unique per session, REQUIRED
 *     "name": "...",
 *     "agentId": "...",
 *     "agentName": "...",
 *     "parentId": null,
 *     "childIds": []
 *   }
 */

import { existsSync } from "node:fs";
import { readFile, writeFile, rename } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { join, dirname } from "node:path";

async function migrateFile(filePath) {
  console.log(`\n📁 ${filePath}`);

  const content = await readFile(filePath, "utf-8");
  const oldData = JSON.parse(content);

  // Skip if already new format
  if (oldData._meta) {
    console.log("   ✅ Already new format, skipping");
    return;
  }

  const sessionsDir = dirname(filePath);

  // Derive workingDir from first entry
  const firstEntry = Object.values(oldData)[0];
  const workingDir = firstEntry?.workingDir || "";

  const newData = {
    _meta: { workingDir },
  };

  let migratedCount = 0;

  for (const [shortId, entry] of Object.entries(oldData)) {
    const newEntry = {};

    // fullPath is REQUIRED and unique per session
    if (entry.fullPath) newEntry.fullPath = entry.fullPath;

    if (entry.name) newEntry.name = entry.name;
    if (entry.agentId) newEntry.agentId = entry.agentId;
    if (entry.agentName) newEntry.agentName = entry.agentName;
    if (entry.parentId != null) newEntry.parentId = entry.parentId;
    if (entry.childIds?.length) newEntry.childIds = entry.childIds;

    // If name is missing/empty, set a default
    if (!newEntry.name) newEntry.name = "New Session";

    newData[shortId] = newEntry;
    migratedCount++;
  }

  // Backup old file
  const backupPath = filePath + ".old";
  await rename(filePath, backupPath);
  console.log(`   💾 Backup: ${backupPath}`);

  // Write new format
  await writeFile(filePath, JSON.stringify(newData, null, 2), "utf-8");
  console.log(`   ✅ Migrated: ${migratedCount} sessions`);
}

async function main() {
  const sessionsRoot = join(
    process.env.HOME || "/root",
    ".pi",
    "agent",
    "sessions"
  );

  if (!existsSync(sessionsRoot)) {
    console.log("No sessions directory found");
    return;
  }

  const { readdir: rd } = await import("node:fs/promises");
  const dirs = await rd(sessionsRoot, { withFileTypes: true });

  let migratedFiles = 0;

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const configPath = join(sessionsRoot, dir.name, "session-config.json");
    if (!existsSync(configPath)) continue;

    await migrateFile(configPath);
    migratedFiles++;
  }

  console.log(`\n🏁 Done. Migrated ${migratedFiles} config files.`);
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
