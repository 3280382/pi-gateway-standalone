#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wsHandlersDir = path.join(__dirname, "src/server/features/chat/ws-handlers");

// Patterns to replace
const patterns = [
  {
    from: /from "\.\.\/\.\.\/\.\.\/\.\.\/lib\/utils\/logger"/g,
    to: 'from "../../../lib/utils/logger"',
  },
  { from: /from "\.\.\/\.\.\/\.\.\/lib\/utils\/logger"/g, to: 'from "../../../lib/utils/logger"' },
  { from: /from "\.\.\/\.\.\/agent-session\//g, to: 'from "../agent-session/' },
  { from: /from "\.\.\/\.\.\/session-helpers"/g, to: 'from "../session-helpers"' },
  { from: /from "\.\.\/\.\.\/ws-router"/g, to: 'from "../ws-router"' },
  { from: /from "\.\.\/\.\.\/\.\.\/ws-router"/g, to: 'from "../ws-router"' },
  { from: /from "\.\.\/ws-router"/g, to: 'from "../ws-router"' }, // Already correct for some
];

// Get all TypeScript files in ws-handlers directory
const files = fs
  .readdirSync(wsHandlersDir)
  .filter(
    (file) =>
      file.endsWith(".ts") &&
      !file.endsWith(".test.ts") &&
      file !== "index.ts" &&
      file !== "handler-utils.ts"
  )
  .map((file) => path.join(wsHandlersDir, file));

console.log(`Found ${files.length} files to process`);

for (const file of files) {
  console.log(`Processing ${path.basename(file)}...`);
  let content = fs.readFileSync(file, "utf-8");
  let changed = false;

  for (const pattern of patterns) {
    const newContent = content.replace(pattern.from, pattern.to);
    if (newContent !== content) {
      changed = true;
      content = newContent;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content, "utf-8");
    console.log(`  Updated ${path.basename(file)}`);
  } else {
    console.log(`  No changes needed for ${path.basename(file)}`);
  }
}

console.log("Done!");
