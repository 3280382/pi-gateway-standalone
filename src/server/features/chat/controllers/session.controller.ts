/**
 * Session Controller
 * Handles session-related API requests
 */

import { DefaultResourceLoader, SessionManager } from "@mariozechner/pi-coding-agent";
import type { Request, Response } from "express";
import { Logger, LogLevel } from "../../../lib/utils/logger";
import { expandPath } from "../../files/utils";
import { AGENT_DIR, getLocalSessionsDir } from "../agent-session/utils";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Get session list
 */
export async function getSessions(req: Request, res: Response) {
  const cwd = (req.query.cwd as string) || process.cwd();
  const localSessionsDir = getLocalSessionsDir(cwd);

  try {
    const sessions = await SessionManager.list(cwd, localSessionsDir);

    logger.info(`[getSessions] Loaded sessions: ${cwd}, count: ${sessions.length}`);

    // Print first session path for debugging
    if (sessions.length > 0) {
      logger.info(`[getSessions] First session path: ${sessions[0].path}`);
    }

    res.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        path: s.path,
        name: s.firstMessage?.slice(0, 50) || s.path.split("/").pop() || "Untitled",
        firstMessage: s.firstMessage,
        messageCount: s.messageCount,
        cwd: s.cwd,
        modified: s.modified.toISOString(),
      })),
    });
  } catch (error) {
    logger.error(`[getSessions] Error: ${error instanceof Error ? error.message : String(error)}`);
    res.json({ sessions: [] });
  }
}

/**
 * Load session file content
 */
export async function loadSession(req: Request, res: Response) {
  const { sessionPath } = req.body;
  logger.info(`[loadSession] Received request: sessionPath=${sessionPath}`);

  if (!sessionPath) {
    res.status(400).json({ error: "sessionPath parameter is required" });
    return;
  }

  try {
    const { readFile, access } = await import("node:fs/promises");

    // Check if file exists
    try {
      await access(sessionPath);
    } catch {
      logger.error(`Session file does not exist: ${sessionPath}`);
      res.status(404).json({ error: "Session file not found", path: sessionPath });
      return;
    }

    const content = await readFile(sessionPath, "utf-8");
    const lines = content
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    // Parse each line with error handling
    const entries = [];
    for (let i = 0; i < lines.length; i++) {
      try {
        entries.push(JSON.parse(lines[i]));
      } catch (_parseError) {
        logger.warn(`Failed to parse session file line ${i + 1}: ${lines[i].slice(0, 100)}`);
        // Skip invalid lines but continue processing
      }
    }

    // Extract session ID from session file path
    const sessionId = sessionPath.split("/").pop()?.replace(".jsonl", "") || "";

    logger.info(`Loaded session: ${sessionPath}, entries: ${entries.length}`);
    res.json({
      path: sessionPath,
      sessionId: sessionId,
      entries,
    });
  } catch (error) {
    logger.error(
      `Error loading session: ${error instanceof Error ? error.message : String(error)}`,
      { sessionPath }
    );
    res.status(500).json({ error: String(error), path: sessionPath });
  }
}

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

import { serverSessionManager } from "../agent-session/session-manager";

/**
 * Get active session list
 */
export async function getActiveSessions(req: Request, res: Response) {
  const workingDir = req.query.workingDir as string;

  if (!workingDir) {
    return res.status(400).json({ 
      error: "workingDir parameter is required" 
    });
  }

  try {
    const activeSessions = serverSessionManager.getActiveSessions(workingDir);
  
    res.json({
      workingDir,
      activeSessions,
      count: activeSessions.length,
    });
  } catch (error) {
    logger.error(`[getActiveSessions] Error: ${error}`);
    res.status(500).json({ 
      error: "Failed to get active sessions" 
    });
  }
}
