/**
 * Extension Controller - 扩展管理
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
 * 扫描扩展目录获取扩展列表
 */
async function scanExtensions(): Promise<ExtensionInfo[]> {
  const extensions: ExtensionInfo[] = [];

  // 扫描全局扩展目录
  const globalExtPath = process.env.PI_GLOBAL_EXTENSIONS || "/root/.pi/extensions";
  // 扫描项目扩展目录
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

        // 尝试读取 package.json
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
          // 尝试读取 manifest.json
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
            // 如果都没有，使用目录名作为扩展名
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
          // 检查是否有禁用标记文件
          try {
            await stat(join(extDir, ".disabled"));
            extInfo.enabled = false;
          } catch {
            // 文件不存在，扩展启用
          }

          extensions.push(extInfo);
        }
      }
    } catch {
      // 目录不存在或无法读取，跳过
    }
  }

  return extensions;
}

/**
 * 获取扩展列表
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
