#!/usr/bin/env node
/**
 * Auto-fix server-side imports for ESM compatibility.
 * Converts bare relative imports to include .js extension or /index.js
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(__dirname, "..", "src", "server");
const SHARED_DIR = join(__dirname, "..", "src", "shared");

const IMPORT_RE = /from\s+['"](\.[./][^'"]+)['"]/g;

function getAllTsFiles(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      getAllTsFiles(full, files);
    } else if (entry.isFile() && full.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

function resolveImport(sourceFile, importPath) {
  const dir = dirname(sourceFile);
  const resolved = join(dir, importPath);

  // Already has extension?
  if (extname(importPath)) return null;

  // Case 1: points to a file (e.g., ./config → ./config.ts)
  if (statSync(resolved + ".ts", { throwIfNoEntry: false })) {
    return importPath + ".js";
  }

  // Case 2: points to a directory with index.ts
  if (statSync(join(resolved, "index.ts"), { throwIfNoEntry: false })) {
    return importPath + "/index.js";
  }

  // Case 3: maybe a .tsx file (unlikely in server)
  if (statSync(resolved + ".tsx", { throwIfNoEntry: false })) {
    return importPath + ".js";
  }

  return null; // can't resolve, leave as-is
}

const files = getAllTsFiles(SERVER_DIR);
let totalFixed = 0;
let totalFiles = 0;

for (const file of files) {
  const content = readFileSync(file, "utf-8");
  let newContent = content;
  let changed = false;

  // Reset regex
  IMPORT_RE.lastIndex = 0;

  // We need to replace from end to start to preserve positions
  const matches = [...content.matchAll(IMPORT_RE)];
  const replacements = [];

  for (const match of matches) {
    const importPath = match[1];
    // Only fix relative imports without extension
    if (!importPath.startsWith(".") || extname(importPath)) continue;

    const fixed = resolveImport(file, importPath);
    if (fixed && fixed !== importPath) {
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        original: match[0],
        replacement: match[0].replace(importPath, fixed),
      });
    }
  }

  if (replacements.length > 0) {
    // Apply replacements from end to start
    replacements.reverse();
    newContent = content;
    for (const r of replacements) {
      newContent = newContent.slice(0, r.start) + r.replacement + newContent.slice(r.end);
    }
    changed = true;
    totalFixed += replacements.length;
  }

  if (changed) {
    writeFileSync(file, newContent, "utf-8");
    console.log(`✅ ${file.replace(SERVER_DIR, "src/server")} — fixed ${replacements.length} import(s)`);
    totalFiles++;
  }
}

console.log(`\n📊 Summary: ${totalFixed} imports fixed across ${totalFiles} files`);
