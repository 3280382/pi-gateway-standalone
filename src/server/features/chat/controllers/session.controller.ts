/**
 * Session Controller
 * Handles session-related API requests
 * Note: Most session operations are handled via WebSocket
 * (list_sessions, load_session, change_dir, new_session)
 * This file only retains HTTP endpoints without WS equivalents.
 */

import { DefaultResourceLoader } from "@mariozechner/pi-coding-agent";
import type { Request, Response } from "express";
import { Logger, LogLevel } from "../../../lib/utils/logger.js";
import { expandPath } from "../../files/utils.js";
import { AGENT_DIR } from "../session/utils.js";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Get system prompt and AGENTS.md content
 */
export async function getSystemPrompt(req: Request, res: Response) {
  const rawCwd = (req.query.cwd as string) || process.cwd();
  const targetCwd = expandPath(rawCwd);

  try {
    const loader = new DefaultResourceLoader({
      cwd: targetCwd,
      agentDir: AGENT_DIR,
    });
    await loader.reload();

    const agentsFiles = loader.getAgentsFiles().agentsFiles;
    const systemPrompt = loader.getSystemPrompt();
    const appendSystemPrompt = loader.getAppendSystemPrompt();
    const skills = loader.getSkills().skills;

    // Build simple default system prompt (if no custom prompt is set)
    const defaultSystemPrompt = `# Pi Coding Agent

Working Directory: ${targetCwd}
Skills: ${skills.length > 0 ? skills.map((s) => s.name).join(", ") : "None"}
AGENTS.md Files: ${agentsFiles.length}

You are Pi Coding Agent, an AI assistant that helps developers write, debug, and optimize code.`;

    const response = {
      cwd: targetCwd,
      agentsFiles: (agentsFiles as any[]).map((file) => ({
        path: file.path,
        content: file.content,
      })),
      systemPrompt: systemPrompt || defaultSystemPrompt,
      appendSystemPrompt: (appendSystemPrompt as any[]).map((file) => ({
        path: file.path,
        content: file.content,
      })),
      skills: skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
      })),
    };

    logger.info(
      `Retrieved system prompt, directory: ${targetCwd}, AGENTS.md files: ${agentsFiles.length}`
    );
    res.json(response);
  } catch (error) {
    logger.error(
      `Error retrieving system prompt: ${error instanceof Error ? error.message : String(error)}`,
      { targetCwd }
    );
    res.status(500).json({ error: String(error) });
  }
}
