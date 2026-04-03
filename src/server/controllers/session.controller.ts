/**
 * 会话控制器
 * 处理会话相关的API请求
 */

import {
	DefaultResourceLoader,
	SessionManager,
} from "@mariozechner/pi-coding-agent";
import type { Request, Response } from "express";
import { expandPath } from "../lib/utils/file-utils";
import { Logger, LogLevel } from "../lib/utils/logger";
import { AGENT_DIR, getLocalSessionsDir } from "../session/utils";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 获取会话列表
 */
export async function getSessions(req: Request, res: Response) {
	const cwd = (req.query.cwd as string) || process.cwd();
	const localSessionsDir = getLocalSessionsDir(cwd);

	try {
		const sessions = await SessionManager.list(cwd, localSessionsDir);

		logger.info(`[getSessions] 加载会话: ${cwd}, 数量: ${sessions.length}`);

		res.json({
			sessions: sessions.map((s) => ({
				id: s.id,
				path: s.path,
				name:
					s.firstMessage?.slice(0, 50) || s.path.split("/").pop() || "Untitled",
				firstMessage: s.firstMessage,
				messageCount: s.messageCount,
				cwd: s.cwd,
				modified: s.modified.toISOString(),
			})),
		});
	} catch (error) {
		logger.error(
			`[getSessions] 错误: ${error instanceof Error ? error.message : String(error)}`,
		);
		res.json({ sessions: [] });
	}
}

/**
 * 加载会话文件内容
 */
export async function loadSession(req: Request, res: Response) {
	const { sessionPath } = req.body;
	if (!sessionPath) {
		res.status(400).json({ error: "sessionPath参数必填" });
		return;
	}

	try {
		const { readFile, access } = await import("node:fs/promises");

		// Check if file exists
		try {
			await access(sessionPath);
		} catch {
			logger.error(`会话文件不存在: ${sessionPath}`);
			res
				.status(404)
				.json({ error: "Session file not found", path: sessionPath });
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
				logger.warn(
					`解析会话文件第 ${i + 1} 行失败: ${lines[i].slice(0, 100)}`,
				);
				// Skip invalid lines but continue processing
			}
		}

		// 从会话文件路径提取会话ID
		const sessionId = sessionPath.split("/").pop()?.replace(".jsonl", "") || "";

		logger.info(`加载会话: ${sessionPath}, 条目数: ${entries.length}`);
		res.json({
			path: sessionPath,
			sessionId: sessionId,
			entries,
		});
	} catch (error) {
		logger.error(
			`加载会话错误: ${error instanceof Error ? error.message : String(error)}`,
			{ sessionPath },
		);
		res.status(500).json({ error: String(error), path: sessionPath });
	}
}

/**
 * 获取系统提示和AGENTS.md内容
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

		// 构建简单默认系统提示（如果没有设置自定义提示）
		const defaultSystemPrompt = `# Pi Coding Agent

工作目录: ${targetCwd}
技能: ${skills.length > 0 ? skills.map((s) => s.name).join(", ") : "无"}
AGENTS.md文件: ${agentsFiles.length} 个

你是Pi Coding Agent，一个帮助开发者编写、调试和优化代码的AI助手。`;

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
			`获取系统提示，目录: ${targetCwd}, AGENTS.md文件数: ${agentsFiles.length}`,
		);
		res.json(response);
	} catch (error) {
		logger.error(
			`获取系统提示错误: ${error instanceof Error ? error.message : String(error)}`,
			{ targetCwd },
		);
		res.status(500).json({ error: String(error) });
	}
}
