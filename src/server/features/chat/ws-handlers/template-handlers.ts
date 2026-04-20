/**
 * Template Handlers
 * Handle prompt template-related WebSocket messages
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { WSContext } from "../ws-router";
import {
  createHandler,
  sendError,
  sendSuccess,
  logger,
} from "./handler-utils";

// ============================================================================
// Template Service
// ============================================================================

interface TemplateFile {
  name: string;
  path: string;
  source: "global" | "local"; // global = ~/.pi/agent/prompts, local = {workingDir}/.pi/prompts
}

/**
 * Search for template files in both global and local prompts directories
 * @param workingDir Current working directory
 * @returns Array of template files
 */
async function findTemplateFiles(workingDir: string): Promise<TemplateFile[]> {
  const templates: TemplateFile[] = [];

  // Global templates: ~/.pi/agent/prompts
  const globalPromptsDir = join(process.env.HOME || "/root", ".pi", "agent", "prompts");
  if (existsSync(globalPromptsDir)) {
    try {
      const globalFiles = await readdir(globalPromptsDir);
      for (const file of globalFiles) {
        if (file.endsWith(".md")) {
          templates.push({
            name: file.replace(".md", ""),
            path: join(globalPromptsDir, file),
            source: "global",
          });
        }
      }
    } catch (error) {
      logger.warn(`[findTemplateFiles] Error reading global prompts dir: ${error}`);
    }
  }

  // Local templates: {workingDir}/.pi/prompts
  const localPromptsDir = join(workingDir, ".pi", "prompts");
  if (existsSync(localPromptsDir)) {
    try {
      const localFiles = await readdir(localPromptsDir);
      for (const file of localFiles) {
        if (file.endsWith(".md")) {
          templates.push({
            name: file.replace(".md", ""),
            path: join(localPromptsDir, file),
            source: "local",
          });
        }
      }
    } catch (error) {
      logger.warn(`[findTemplateFiles] Error reading local prompts dir: ${error}`);
    }
  }

  // Sort by name
  templates.sort((a, b) => a.name.localeCompare(b.name));

  return templates;
}

/**
 * Read template file content
 * @param templatePath Full path to the template file
 * @returns File content
 */
async function readTemplateContent(templatePath: string): Promise<string> {
  try {
    const content = await readFile(templatePath, "utf-8");
    return content;
  } catch (error) {
    logger.error(`[readTemplateContent] Error reading ${templatePath}: ${error}`);
    throw new Error(`Failed to read template file: ${templatePath}`);
  }
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * Handle list_templates message
 * Returns list of available prompt templates
 */
export async function handleListTemplates(
  ctx: WSContext,
  _payload: unknown
): Promise<void> {
  const workingDir = ctx.session.workingDir;
  
  logger.info(`[handleListTemplates] Searching templates for: ${workingDir}`);
  
  const templates = await findTemplateFiles(workingDir);
  
  sendSuccess(ctx, "templates_list", {
    templates: templates.map((t) => ({
      name: t.name,
      source: t.source,
      path: t.path,
    })),
    count: templates.length,
  });
  
  logger.info(`[handleListTemplates] Found ${templates.length} templates`);
}

/**
 * Handle get_template message
 * Returns content of a specific template
 */
export async function handleGetTemplate(
  ctx: WSContext,
  payload: { name?: string; path?: string }
): Promise<void> {
  const { name, path: templatePath } = payload;
  
  if (!name && !templatePath) {
    sendError(ctx, "Template name or path is required");
    return;
  }
  
  let targetPath = templatePath;
  
  // If only name provided, search for it
  if (!targetPath && name) {
    const workingDir = ctx.session.workingDir;
    const templates = await findTemplateFiles(workingDir);
    const template = templates.find((t) => t.name === name);
    
    if (!template) {
      sendError(ctx, `Template not found: ${name}`);
      return;
    }
    
    targetPath = template.path;
  }
  
  if (!targetPath) {
    sendError(ctx, "Could not resolve template path");
    return;
  }
  
  // Security check: ensure the path is within allowed directories
  const globalPromptsDir = join(process.env.HOME || "/root", ".pi", "agent", "prompts");
  const localPromptsDir = join(ctx.session.workingDir, ".pi", "prompts");
  
  if (!targetPath.startsWith(globalPromptsDir) && !targetPath.startsWith(localPromptsDir)) {
    sendError(ctx, "Invalid template path: access denied");
    return;
  }
  
  try {
    const content = await readTemplateContent(targetPath);
    
    sendSuccess(ctx, "template_content", {
      name: name || targetPath.split("/").pop()?.replace(".md", ""),
      path: targetPath,
      content,
    });
    
    logger.info(`[handleGetTemplate] Sent template: ${targetPath}`);
  } catch (error) {
    sendError(ctx, error instanceof Error ? error.message : "Failed to read template");
  }
}

// ============================================================================
// Wrapped Handlers for Registration
// ============================================================================

export const handleListTemplatesWrapped = createHandler(handleListTemplates, {
  name: "list_templates",
  requireSession: true,
});

export const handleGetTemplateWrapped = createHandler(handleGetTemplate, {
  name: "get_template",
  requireSession: true,
});
