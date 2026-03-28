/**
 * 文件控制器
 * 处理文件系统API请求
 */

import type { Request, Response } from "express";
import { homedir } from "os";
import * as path from "path";
import { expandPath, getMimeType, isBinaryFile, isHighlightable, isPathAllowed } from "../lib/utils/file-utils";
import { Logger, LogLevel } from "../lib/utils/logger";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 浏览目录
 */
export async function browseDirectory(req: Request, res: Response) {
	const { path: browsePath } = req.body;
	const targetPath = browsePath || homedir();

	try {
		const startTime = Date.now();
		const { readdir, stat } = await import("fs/promises");
		const entries = await readdir(targetPath, { withFileTypes: true });

		// 并行获取文件状态（限制并发数）
		const concurrencyLimit = 10;
		const items = [];

		for (let i = 0; i < entries.length; i += concurrencyLimit) {
			const batch = entries.slice(i, i + concurrencyLimit);
			const batchResults = await Promise.all(
				batch.map(async (entry) => {
					const fullPath = path.join(targetPath, entry.name);
					const stats = await stat(fullPath).catch(() => null);
					return {
						name: entry.name,
						path: fullPath,
						isDirectory: entry.isDirectory(),
						size: stats?.size || 0,
						modified: stats?.mtime.toISOString() || new Date().toISOString(),
						extension: entry.isDirectory()
							? undefined
							: entry.name.includes(".")
								? entry.name.split(".").pop()?.toLowerCase()
								: undefined,
					};
				}),
			);
			items.push(...batchResults);
		}

		items.sort((a, b) => {
			if (a.isDirectory === b.isDirectory) {
				return a.name.localeCompare(b.name);
			}
			return a.isDirectory ? -1 : 1;
		});

		const response = {
			currentPath: targetPath,
			parentPath: path.dirname(targetPath),
			items,
			metadata: {
				count: items.length,
				directories: items.filter((i) => i.isDirectory).length,
				files: items.filter((i) => !i.isDirectory).length,
				processingTime: Date.now() - startTime,
			},
		};

		logger.info(`浏览目录: ${targetPath}, 项目数: ${items.length}`);
		res.json(response);
	} catch (error) {
		logger.error(`文件浏览错误: ${error instanceof Error ? error.message : String(error)}`, { targetPath });
		res.status(500).json({
			error: String(error),
			code: "BROWSE_ERROR",
			path: targetPath,
			timestamp: new Date().toISOString(),
		});
	}
}

/**
 * 获取目录树
 */
export async function getDirectoryTree(req: Request, res: Response) {
	const rawPath = req.query.path as string;

	if (!rawPath) {
		res.status(400).json({ error: "path参数必填" });
		return;
	}

	const targetPath = expandPath(rawPath);

	if (!isPathAllowed(targetPath)) {
		res.status(403).json({ error: "访问被拒绝" });
		return;
	}

	try {
		const { stat, readdir } = await import("fs/promises");
		const stats = await stat(targetPath);

		if (!stats.isDirectory()) {
			res.status(400).json({ error: "路径不是目录" });
			return;
		}

		const buildTree = async (dirPath: string, depth: number, maxDepth: number = 3): Promise<any> => {
			if (depth >= maxDepth) {
				return {
					name: path.basename(dirPath),
					path: dirPath,
					isDirectory: true,
					truncated: true,
				};
			}

			const entries = await readdir(dirPath, { withFileTypes: true });
			const children = [];

			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name);
				const childStats = await stat(fullPath).catch(() => null);

				if (!childStats) continue;

				if (entry.isDirectory()) {
					const childTree = await buildTree(fullPath, depth + 1, maxDepth);
					children.push(childTree);
				} else {
					children.push({
						name: entry.name,
						path: fullPath,
						isDirectory: false,
						size: childStats.size,
						modified: childStats.mtime.toISOString(),
						extension: entry.name.includes(".") ? entry.name.split(".").pop()?.toLowerCase() : undefined,
					});
				}
			}

			return {
				name: path.basename(dirPath),
				path: dirPath,
				isDirectory: true,
				children,
			};
		};

		const tree = await buildTree(targetPath, 0);
		logger.info(`获取目录树: ${targetPath}`);
		res.json(tree);
	} catch (error) {
		logger.error(`获取目录树错误: ${error instanceof Error ? error.message : String(error)}`, { targetPath });
		res.status(500).json({ error: String(error) });
	}
}

/**
 * 获取文件内容
 */
export async function getFileContent(req: Request, res: Response) {
	const rawPath = req.query.path as string;

	if (!rawPath) {
		res.status(400).json({ error: "path参数必填" });
		return;
	}

	const targetPath = expandPath(rawPath);

	if (!isPathAllowed(targetPath)) {
		res.status(403).json({ error: "访问被拒绝" });
		return;
	}

	try {
		const { stat, readFile } = await import("fs/promises");
		const stats = await stat(targetPath);

		if (stats.isDirectory()) {
			res.status(400).json({ error: "路径是目录，请使用/api/files/tree" });
			return;
		}

		// 限制内容API的文件大小为10MB
		if (stats.size > 10 * 1024 * 1024) {
			res.status(413).json({ error: "文件太大，请使用/api/files/raw" });
			return;
		}

		const content = await readFile(targetPath, "utf-8");

		logger.info(`获取文件内容: ${targetPath}, 大小: ${stats.size}字节`);
		res.json({
			path: targetPath,
			content,
			size: stats.size,
			modified: stats.mtime.toISOString(),
			mimeType: getMimeType(targetPath),
			highlightable: isHighlightable(targetPath),
			binary: isBinaryFile(targetPath),
		});
	} catch (error) {
		logger.error(`获取文件内容错误: ${error instanceof Error ? error.message : String(error)}`, { targetPath });
		res.status(500).json({ error: String(error) });
	}
}

/**
 * 获取原始文件（图片、HTML等）
 */
export async function getRawFile(req: Request, res: Response) {
	const rawPath = req.query.path as string;

	if (!rawPath) {
		res.status(400).json({ error: "path参数必填" });
		return;
	}

	const targetPath = expandPath(rawPath);

	if (!isPathAllowed(targetPath)) {
		res.status(403).json({ error: "访问被拒绝" });
		return;
	}

	try {
		const { stat, readFile } = await import("fs/promises");
		const stats = await stat(targetPath);

		if (stats.isDirectory()) {
			res.status(400).json({ error: "路径是目录" });
			return;
		}

		const mimeType = getMimeType(targetPath);
		res.setHeader("Content-Type", mimeType);
		res.setHeader("Content-Length", stats.size.toString());
		res.setHeader("Last-Modified", stats.mtime.toUTCString());

		const content = await readFile(targetPath);

		logger.info(`获取原始文件: ${targetPath}, MIME类型: ${mimeType}, 大小: ${stats.size}字节`);
		res.send(content);
	} catch (error) {
		logger.error(`获取原始文件错误: ${error instanceof Error ? error.message : String(error)}`, { targetPath });
		res.status(500).json({ error: String(error) });
	}
}

/**
 * 写入文件内容
 */
export async function writeFileContent(req: Request, res: Response) {
	const { path: filePath, content } = req.body;

	if (!filePath || content === undefined) {
		res.status(400).json({ error: "path和content参数必填" });
		return;
	}

	const targetPath = expandPath(filePath);

	if (!isPathAllowed(targetPath)) {
		res.status(403).json({ error: "访问被拒绝" });
		return;
	}

	try {
		const { writeFile, mkdir } = await import("fs/promises");
		const { dirname } = path;

		// 确保目录存在
		const dir = dirname(targetPath);
		await mkdir(dir, { recursive: true });

		// 写入文件
		await writeFile(targetPath, content, "utf-8");

		logger.info(`写入文件: ${targetPath}, 大小: ${content.length}字符`);
		res.json({ success: true, path: targetPath });
	} catch (error) {
		logger.error(`写入文件错误: ${error instanceof Error ? error.message : String(error)}`, { targetPath });
		res.status(500).json({ error: String(error) });
	}
}

/**
 * 执行命令（用于文件执行）
 */
export async function executeCommand(req: Request, res: Response) {
	const { command, cwd, streaming } = req.body;

	if (!command) {
		res.status(400).json({ error: "command参数必填" });
		return;
	}

	const workingDir = cwd ? expandPath(cwd) : process.cwd();

	if (!isPathAllowed(workingDir)) {
		res.status(403).json({ error: "访问被拒绝" });
		return;
	}

	try {
		const { spawn } = await import("child_process");

		// 解析命令
		const [cmd, ...args] = command.split(" ").map((s: string) => s.replace(/^"|"$/g, "").replace(/^'|'$/g, ""));

		if (streaming) {
			// 流式执行
			const child = spawn(cmd, args, {
				cwd: workingDir,
				env: process.env,
				shell: false,
			});

			// 设置流式响应
			res.setHeader("Content-Type", "text/plain; charset=utf-8");
			res.setHeader("Transfer-Encoding", "chunked");

			child.stdout.on("data", (data: Buffer) => {
				res.write(data);
			});

			child.stderr.on("data", (data: Buffer) => {
				res.write(data);
			});

			child.on("close", (code: number | null) => {
				res.write(`\n\n[进程退出，代码: ${code ?? "未知"}]\n`);
				res.end();
			});

			child.on("error", (error: Error) => {
				res.write(`[执行错误: ${error.message}]\n`);
				res.end();
			});

			logger.info(`流式执行命令: ${command}, 工作目录: ${workingDir}`);
		} else {
			// 非流式执行
			const child = spawn(cmd, args, {
				cwd: workingDir,
				env: process.env,
				shell: false,
			});

			let output = "";
			let errorOutput = "";

			child.stdout.on("data", (data: Buffer) => {
				output += data.toString();
			});

			child.stderr.on("data", (data: Buffer) => {
				errorOutput += data.toString();
			});

			child.on("close", (code: number | null) => {
				const isError = code !== 0;
				const result = errorOutput ? `${output}\n${errorOutput}`.trim() : output.trim();

				logger.info(`执行命令: ${command}, 工作目录: ${workingDir}, 退出代码: ${code}`);
				res.json({
					success: !isError,
					output: result || "(无输出)",
					exitCode: code,
					isError,
				});
			});

			child.on("error", (error: Error) => {
				logger.error(`执行命令错误: ${error.message}`, { command, workingDir });
				res.json({
					success: false,
					output: error.message,
					exitCode: null,
					isError: true,
				});
			});
		}
	} catch (error) {
		logger.error(`执行命令异常: ${error instanceof Error ? error.message : String(error)}`, { command, workingDir });
		res.status(500).json({ error: String(error) });
	}
}
