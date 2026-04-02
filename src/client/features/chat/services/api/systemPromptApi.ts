/**
 * System Prompt API - 系统提示词相关API
 * 按照 pi coding agent 的方式加载 SYSTEM.md 和 AGENTS.md
 */

export interface SystemPromptResponse {
	cwd: string;
	agentsFiles: Array<{
		path: string;
		content: string;
	}>;
	systemPrompt: string;
	appendSystemPrompt: Array<{
		path: string;
		content: string;
	}>;
	skills: Array<{
		name: string;
		description: string;
	}>;
}

/**
 * 获取系统提示词和 AGENTS.md 内容
 * @param cwd 工作目录（可选，默认为当前工作目录）
 */
export async function getSystemPrompt(
	cwd?: string,
): Promise<SystemPromptResponse> {
	const url = new URL("/api/system-prompt", window.location.origin);
	if (cwd) {
		url.searchParams.set("cwd", cwd);
	}

	const response = await fetch(url.toString());

	if (!response.ok) {
		throw new Error(`Failed to get system prompt: ${response.statusText}`);
	}

	return response.json();
}

/**
 * 格式化系统提示词内容为可读文本
 */
export function formatSystemPromptContent(data: SystemPromptResponse): string {
	const sections: string[] = [];

	// 工作目录信息
	sections.push(`# 工作目录\n${data.cwd}\n`);

	// 主系统提示
	if (data.systemPrompt) {
		sections.push(`# 系统提示词 (SYSTEM.md)\n${data.systemPrompt}\n`);
	}

	// AGENTS.md 文件
	if (data.agentsFiles.length > 0) {
		sections.push(`# AGENTS.md 文件 (${data.agentsFiles.length}个)`);
		for (const file of data.agentsFiles) {
			sections.push(`\n## ${file.path}\n${file.content}`);
		}
		sections.push("");
	}

	// 附加系统提示
	if (data.appendSystemPrompt.length > 0) {
		sections.push(`# 附加系统提示 (${data.appendSystemPrompt.length}个)`);
		for (const file of data.appendSystemPrompt) {
			sections.push(`\n## ${file.path}\n${file.content}`);
		}
		sections.push("");
	}

	// 技能列表
	if (data.skills.length > 0) {
		sections.push(`# 可用技能 (${data.skills.length}个)`);
		for (const skill of data.skills) {
			sections.push(`- ${skill.name}: ${skill.description}`);
		}
	}

	return sections.join("\n");
}
