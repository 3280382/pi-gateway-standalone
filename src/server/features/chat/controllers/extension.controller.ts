/**
 * Extension Controller - Extension management
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Request, Response } from "express";

interface ExtensionInfo {
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  path: string;
}

/**
 * Scan extension directories to get extension list
 */
async function scanExtensions(): Promise<ExtensionInfo[]> {
  const extensions: ExtensionInfo[] = [];

  // Scan global extension directory
  const globalExtPath = process.env.PI_GLOBAL_EXTENSIONS || "/root/.pi/extensions";
  // Scan project extension directory
  const projectExtPath = `${process.cwd()}/.pi/extensions`;

  const scanPaths = [
    { path: globalExtPath, type: "global" },
    { path: projectExtPath, type: "project" },
  ];

  for (const { path: extPath } of scanPaths) {
    try {
      const entries = await readdir(extPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const extDir = join(extPath, entry.name);
        const packageJsonPath = join(extDir, "package.json");
        const manifestPath = join(extDir, "manifest.json");

        let extInfo: ExtensionInfo | null = null;

        // Try reading package.json
        try {
          const packageContent = await readFile(packageJsonPath, "utf-8");
          const pkg = JSON.parse(packageContent);
          extInfo = {
            name: pkg.name || entry.name,
            version: pkg.version || "0.0.1",
            description: pkg.description || "No description",
            enabled: true,
            path: extDir,
          };
        } catch {
          // Try reading manifest.json
          try {
            const manifestContent = await readFile(manifestPath, "utf-8");
            const manifest = JSON.parse(manifestContent);
            extInfo = {
              name: manifest.name || entry.name,
              version: manifest.version || "0.0.1",
              description: manifest.description || "No description",
              enabled: manifest.enabled !== false,
              path: extDir,
            };
          } catch {
            // If neither, use directory name as extension name
            extInfo = {
              name: entry.name,
              version: "0.0.1",
              description: "Extension without manifest",
              enabled: true,
              path: extDir,
            };
          }
        }

        if (extInfo) {
          // Check if disable marker file exists
          try {
            await stat(join(extDir, ".disabled"));
            extInfo.enabled = false;
          } catch {
            // Files不存在，扩展启用
          }

          extensions.push(extInfo);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read, skip
    }
  }

  return extensions;
}

/**
 * Get extension list
 */
export async function getExtensions(_req: Request, res: Response): Promise<void> {
  try {
    const extensions = await scanExtensions();
    res.json({
      success: true,
      extensions,
      count: extensions.length,
    });
  } catch (error) {
    console.error("[ExtensionController] Failed to get extensions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load extensions",
      extensions: [],
      count: 0,
    });
  }
}
