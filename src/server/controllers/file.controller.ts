/**
 * 文件控制器
 * 处理文件系统API请求
 */

import { homedir } from "node:os";
import * as path from "node:path";
import type { Request, Response } from "express";
import {
	expandPath,
	getMimeType,
	isBinaryFile,
	isHighlightable,
	isPathAllowed,
} from "../lib/utils/file-utils";
import { Logger, LogLevel } from "../lib/utils/logger";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 浏览目录
 */
export async function browseDirectory(req: Request, res: Response) {
	const { path: browsePath } = req.body;
	const targetPath = browsePath || homedir();

	// 记录请求来源信息
	const clientInfo = req.headers["user-agent"]?.substring(0, 50) || "unknown";
	logger.info(
		`[browseDirectory] 收到请求: path="${targetPath}", client="${clientInfo}"`,
	);

	try {
		const startTime = Date.now();
		const { readdir, stat } = await import("node:fs/promises");
		const entries = await readdir(targetPath, { withFileTypes: true });

		logger.info(`[browseDirectory] 读取目录成功: ${entries.length} 个条目`);

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

		logger.info(
			`[browseDirectory] 响应成功: ${targetPath}, ${items.length} 个项目 (${items.filter((i) => i.isDirectory).length} 目录, ${items.filter((i) => !i.isDirectory).length} 文件), 耗时: ${Date.now() - startTime}ms`,
		);
		res.json(response);
	} catch (error) {
		logger.error(
			`文件浏览错误: ${error instanceof Error ? error.message : String(error)}`,
			{ targetPath },
		);
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
		const { stat, readdir } = await import("node:fs/promises");
		const stats = await stat(targetPath);

		if (!stats.isDirectory()) {
			res.status(400).json({ error: "路径不是目录" });
			return;
		}

		const buildTree = async (
			dirPath: string,
			depth: number,
			maxDepth: number = 3,
		): Promise<any> => {
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
						extension: entry.name.includes(".")
							? entry.name.split(".").pop()?.toLowerCase()
							: undefined,
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
		logger.error(
			`获取目录树错误: ${error instanceof Error ? error.message : String(error)}`,
			{ targetPath },
		);
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
		const { stat, readFile } = await import("node:fs/promises");
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
		logger.error(
			`获取文件内容错误: ${error instanceof Error ? error.message : String(error)}`,
			{ targetPath },
		);
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
		const { stat, readFile } = await import("node:fs/promises");
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

		logger.info(
			`获取原始文件: ${targetPath}, MIME类型: ${mimeType}, 大小: ${stats.size}字节`,
		);
		res.send(content);
	} catch (error) {
		logger.error(
			`获取原始文件错误: ${error instanceof Error ? error.message : String(error)}`,
			{ targetPath },
		);
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
		const { writeFile, mkdir } = await import("node:fs/promises");
		const { dirname } = path;

		// 确保目录存在
		const dir = dirname(targetPath);
		await mkdir(dir, { recursive: true });

		// 写入文件
		await writeFile(targetPath, content, "utf-8");

		logger.info(`写入文件: ${targetPath}, 大小: ${content.length}字符`);
		res.json({ success: true, path: targetPath });
	} catch (error) {
		logger.error(
			`写入文件错误: ${error instanceof Error ? error.message : String(error)}`,
			{ targetPath },
		);
		res.status(500).json({ error: String(error) });
	}
}

/**
 * 批量删除文件
 * 安全限制：
 * 1. 最多删除 100 个文件
 * 2. 禁止删除系统关键目录
 * 3. 所有路径必须通过 isPathAllowed 检查
 * 4. 记录详细日志
 */

// 禁止删除的系统关键目录（仅系统目录，不包括用户目录）
const PROTECTED_PATHS = [
	"/",
	"/bin",
	"/boot",
	"/dev",
	"/etc",
	"/lib",
	"/lib64",
	"/proc",
	"/run",
	"/sbin",
	"/sys",
	"/usr",
	"/var",
	// 注意：/root 和 /home 被移除，因为用户需要管理自己的文件
	// 这些路径通过 isPathAllowed 进行基础保护
];

const MAX_DELETE_COUNT = 100;

export async function batchDeleteFiles(req: Request, res: Response) {
	const { paths } = req.body;

	// 参数校验
	if (!paths || !Array.isArray(paths) || paths.length === 0) {
		res.status(400).json({ error: "paths参数必填且必须是非空数组" });
		return;
	}

	// 数量限制
	if (paths.length > MAX_DELETE_COUNT) {
		res.status(400).json({
			error: `一次最多只能删除 ${MAX_DELETE_COUNT} 个文件`,
			maxAllowed: MAX_DELETE_COUNT,
			requested: paths.length,
		});
		return;
	}

	const results = [];
	const errors = [];
	let totalSize = 0;

	try {
		const { unlink, stat, rmdir } = await import("node:fs/promises");

		// 第一阶段：验证所有路径
		const validatedPaths = [];
		for (const filePath of paths) {
			const targetPath = expandPath(filePath);

			// 检查是否在允许的路径范围内
			if (!isPathAllowed(targetPath)) {
				errors.push({
					path: filePath,
					error: "访问被拒绝 - 路径不在允许范围内",
				});
				continue;
			}

			// 检查是否是受保护的系统目录
			const isProtected = PROTECTED_PATHS.some(
				(protectedPath) =>
					targetPath === protectedPath ||
					targetPath.startsWith(`${protectedPath}/`),
			);
			if (isProtected) {
				errors.push({
					path: filePath,
					error: "访问被拒绝 - 系统关键目录受保护",
				});
				logger.warn(`尝试删除受保护路径: ${targetPath}`);
				continue;
			}

			// 检查文件/目录是否存在
			try {
				const stats = await stat(targetPath);
				validatedPaths.push({
					originalPath: filePath,
					resolvedPath: targetPath,
					isDirectory: stats.isDirectory(),
					size: stats.size,
				});
				totalSize += stats.size;
			} catch {
				errors.push({ path: filePath, error: "文件或目录不存在" });
			}
		}

		// 如果没有有效路径，直接返回
		if (validatedPaths.length === 0) {
			res.status(400).json({
				error: "没有可删除的有效文件或目录",
				validated: 0,
				requested: paths.length,
				errors,
			});
			return;
		}

		// 第二阶段：执行删除
		logger.info(
			`开始批量删除: ${validatedPaths.length} 个项目, 总大小: ${totalSize} 字节`,
		);

		for (const {
			originalPath,
			resolvedPath,
			isDirectory,
			size,
		} of validatedPaths) {
			try {
				if (isDirectory) {
					// 递归删除目录
					await rmdir(resolvedPath, { recursive: true });
					logger.info(`删除目录成功: ${resolvedPath}`);
				} else {
					// 删除文件
					await unlink(resolvedPath);
					logger.info(`删除文件成功: ${resolvedPath}, 大小: ${size} 字节`);
				}

				results.push({
					path: originalPath,
					success: true,
					isDirectory,
					size,
				});
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				errors.push({ path: originalPath, error: errorMsg });
				logger.error(`删除失败: ${resolvedPath}, 错误: ${errorMsg}`);
			}
		}

		// 记录完整结果
		const success = errors.length === 0;
		const statusCode = success ? 200 : errors.length < paths.length ? 207 : 400;

		logger.info(
			`批量删除完成: ${results.length} 成功, ${errors.length} 失败, 总大小: ${totalSize} 字节`,
		);

		res.status(statusCode).json({
			success,
			deleted: results.length,
			failed: errors.length,
			totalSize,
			results: success ? undefined : results,
			errors: errors.length > 0 ? errors : undefined,
		});
	} catch (error) {
		logger.error(
			`批量删除系统错误: ${error instanceof Error ? error.message : String(error)}`,
		);
		res.status(500).json({
			error: "删除操作失败",
			details: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * 批量移动文件
 */
export async function batchMoveFiles(req: Request, res: Response) {
	const { paths, targetPath } = req.body;

	if (!paths || !Array.isArray(paths) || paths.length === 0) {
		res.status(400).json({ error: "paths参数必填且必须是非空数组" });
		return;
	}

	if (!targetPath) {
		res.status(400).json({ error: "targetPath参数必填" });
		return;
	}

	const expandedTarget = expandPath(targetPath);

	if (!isPathAllowed(expandedTarget)) {
		res.status(403).json({ error: "目标路径访问被拒绝" });
		return;
	}

	const results = [];
	const errors = [];

	try {
		const { rename, stat, mkdir } = await import("node:fs/promises");

		// 确保目标目录存在
		try {
			const targetStats = await stat(expandedTarget);
			if (!targetStats.isDirectory()) {
				res.status(400).json({ error: "目标路径必须是目录" });
				return;
			}
		} catch {
			// 目录不存在，创建它
			await mkdir(expandedTarget, { recursive: true });
		}

		for (const filePath of paths) {
			const sourcePath = expandPath(filePath);

			if (!isPathAllowed(sourcePath)) {
				errors.push({ path: filePath, error: "源路径访问被拒绝" });
				continue;
			}

			try {
				const fileName = path.basename(sourcePath);
				const destPath = path.join(expandedTarget, fileName);

				// 检查目标是否已存在
				try {
					await stat(destPath);
					// 文件已存在，添加数字后缀
					const ext = path.extname(fileName);
					const base = path.basename(fileName, ext);
					let newDestPath = destPath;
					let counter = 1;

					while (true) {
						const newName = `${base} (${counter})${ext}`;
						newDestPath = path.join(expandedTarget, newName);
						try {
							await stat(newDestPath);
							counter++;
						} catch {
							break;
						}
					}

					await rename(sourcePath, newDestPath);
					results.push({
						path: filePath,
						success: true,
						destination: newDestPath,
					});
				} catch {
					// 目标不存在，直接移动
					await rename(sourcePath, destPath);
					results.push({
						path: filePath,
						success: true,
						destination: destPath,
					});
				}

				logger.info(`移动成功: ${sourcePath} -> ${expandedTarget}`);
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				errors.push({ path: filePath, error: errorMsg });
				logger.error(`移动失败: ${sourcePath}, 错误: ${errorMsg}`);
			}
		}

		logger.info(`批量移动完成: ${results.length} 成功, ${errors.length} 失败`);
		res.json({
			success: errors.length === 0,
			moved: results.length,
			errors: errors.length > 0 ? errors : undefined,
		});
	} catch (error) {
		logger.error(
			`批量移动错误: ${error instanceof Error ? error.message : String(error)}`,
		);
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
		const { spawn } = await import("node:child_process");

		// 解析命令
		const [cmd, ...args] = command
			.split(" ")
			.map((s: string) => s.replace(/^"|"$/g, "").replace(/^'|'$/g, ""));

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
				const result = errorOutput
					? `${output}\n${errorOutput}`.trim()
					: output.trim();

				logger.info(
					`执行命令: ${command}, 工作目录: ${workingDir}, 退出代码: ${code}`,
				);
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
		logger.error(
			`执行命令异常: ${error instanceof Error ? error.message : String(error)}`,
			{ command, workingDir },
		);
		res.status(500).json({ error: String(error) });
	}
}
