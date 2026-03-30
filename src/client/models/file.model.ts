/**
 * File Model - 文件数据模型
 * 前后端共享的文件业务逻辑和数据操作
 */

import type { FileItem } from "@/types/file.types";
import { BaseModel } from "./base.model";

export class FileModel extends BaseModel<FileItem> {
	/**
	 * 构造函数
	 */
	constructor(data: FileItem) {
		super({
			name: data.name,
			path: data.path,
			isDirectory: data.isDirectory,
			size: data.size || 0,
			modified: data.modified || new Date().toISOString(),
			extension:
				data.extension ||
				FileModel.extractExtension(data.name, data.isDirectory),
			permissions: data.permissions,
		});
	}

	/**
	 * 提取文件扩展名
	 */
	private static extractExtension(
		name: string,
		isDirectory: boolean,
	): string | undefined {
		if (isDirectory) return undefined;

		const parts = name.split(".");
		if (parts.length > 1) {
			return parts.pop()?.toLowerCase();
		}
		return undefined;
	}

	/**
	 * 从JSON创建
	 */
	static fromJSON(data: FileItem): FileModel {
		return new FileModel(data);
	}

	/**
	 * 批量从JSON创建
	 */
	static fromJSONArray(items: FileItem[]): FileModel[] {
		return items.map((item) => new FileModel(item));
	}

	/**
	 * 获取文件图标
	 */
	getIcon(): string {
		if (this.data.isDirectory) {
			return "📁";
		}

		const ext = this.data.extension;
		if (!ext) return "📄";

		const iconMap: Record<string, string> = {
			// 代码文件
			js: "📜",
			jsx: "⚛️",
			ts: "📜",
			tsx: "⚛️",
			json: "📋",
			yml: "📋",
			yaml: "📋",
			xml: "📋",
			html: "🌐",
			css: "🎨",
			scss: "🎨",
			sass: "🎨",
			less: "🎨",

			// 脚本文件
			py: "🐍",
			rb: "💎",
			php: "🐘",
			java: "☕",
			c: "🔧",
			cpp: "🔧",
			h: "🔧",
			cs: "🔷",
			go: "🐹",
			rs: "🦀",
			swift: "🐦",

			// 配置文件
			env: "⚙️",
			config: "⚙️",
			ini: "⚙️",
			toml: "⚙️",

			// 文档文件
			md: "📝",
			txt: "📝",
			pdf: "📕",
			doc: "📘",
			docx: "📘",

			// 图片文件
			jpg: "🖼️",
			jpeg: "🖼️",
			png: "🖼️",
			gif: "🖼️",
			svg: "🖼️",
			webp: "🖼️",

			// 压缩文件
			zip: "📦",
			tar: "📦",
			gz: "📦",
			"7z": "📦",
			rar: "📦",

			// 可执行文件
			exe: "⚙️",
			sh: "📜",
			bash: "📜",
			bat: "📜",
			cmd: "📜",
		};

		return iconMap[ext] || "📄";
	}

	/**
	 * 获取文件类型
	 */
	getType(): string {
		if (this.data.isDirectory) return "directory";

		const ext = this.data.extension;
		if (!ext) return "unknown";

		const typeMap: Record<string, string> = {
			// 代码文件
			js: "JavaScript",
			jsx: "React JSX",
			ts: "TypeScript",
			tsx: "React TypeScript",
			json: "JSON",
			yml: "YAML",
			yaml: "YAML",
			xml: "XML",
			html: "HTML",
			css: "CSS",
			scss: "SCSS",
			sass: "SASS",
			less: "LESS",

			// 脚本文件
			py: "Python",
			rb: "Ruby",
			php: "PHP",
			java: "Java",
			c: "C",
			cpp: "C++",
			h: "C Header",
			cs: "C#",
			go: "Go",
			rs: "Rust",
			swift: "Swift",

			// 文档文件
			md: "Markdown",
			txt: "Text",
			pdf: "PDF",
			doc: "Word",
			docx: "Word",
		};

		return typeMap[ext] || "file";
	}

	/**
	 * 格式化文件大小
	 */
	formatSize(): string {
		if (this.data.isDirectory) return "--";
		if (!this.data.size || this.data.size === 0) return "0 B";

		const units = ["B", "KB", "MB", "GB", "TB"];
		let size = this.data.size;
		let unitIndex = 0;

		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}

		return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
	}

	/**
	 * 格式化修改时间
	 */
	formatModified(): string {
		if (!this.data.modified) return "Unknown";

		const date = new Date(this.data.modified);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) {
			// 今天
			return date.toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			});
		} else if (diffDays === 1) {
			// 昨天
			return "Yesterday";
		} else if (diffDays < 7) {
			// 本周内
			return date.toLocaleDateString([], { weekday: "short" });
		} else if (date.getFullYear() === now.getFullYear()) {
			// 今年内
			return date.toLocaleDateString([], { month: "short", day: "numeric" });
		} else {
			// 更早
			return date.toLocaleDateString([], {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
		}
	}

	/**
	 * 获取完整的修改时间
	 */
	getFullModified(): string {
		if (!this.data.modified) return "Unknown";
		const date = new Date(this.data.modified);
		return date.toLocaleString();
	}

	/**
	 * 是否可编辑
	 */
	isEditable(): boolean {
		if (this.data.isDirectory) return false;

		const editableExtensions = [
			"txt",
			"md",
			"js",
			"jsx",
			"ts",
			"tsx",
			"json",
			"yml",
			"yaml",
			"xml",
			"html",
			"css",
			"scss",
			"sass",
			"less",
			"py",
			"rb",
			"php",
			"java",
			"c",
			"cpp",
			"h",
			"cs",
			"go",
			"rs",
			"swift",
			"sh",
			"bash",
			"env",
			"config",
			"ini",
			"toml",
		];

		return (
			!this.data.extension || editableExtensions.includes(this.data.extension)
		);
	}

	/**
	 * 是否可执行
	 */
	isExecutable(): boolean {
		if (this.data.isDirectory) return false;

		const executableExtensions = [
			"sh",
			"bash",
			"py",
			"rb",
			"php",
			"js",
			"ts",
			"exe",
			"bat",
			"cmd",
		];

		return this.data.extension
			? executableExtensions.includes(this.data.extension)
			: false;
	}

	/**
	 * 是否是图片文件
	 */
	isImage(): boolean {
		const imageExtensions = [
			"jpg",
			"jpeg",
			"png",
			"gif",
			"svg",
			"webp",
			"bmp",
			"ico",
		];
		return this.data.extension
			? imageExtensions.includes(this.data.extension)
			: false;
	}

	/**
	 * 是否是代码文件
	 */
	isCodeFile(): boolean {
		const codeExtensions = [
			"js",
			"jsx",
			"ts",
			"tsx",
			"json",
			"yml",
			"yaml",
			"xml",
			"html",
			"css",
			"scss",
			"sass",
			"less",
			"py",
			"rb",
			"php",
			"java",
			"c",
			"cpp",
			"h",
			"cs",
			"go",
			"rs",
			"swift",
			"sh",
			"bash",
		];

		return this.data.extension
			? codeExtensions.includes(this.data.extension)
			: false;
	}

	/**
	 * 是否是配置文件
	 */
	isConfigFile(): boolean {
		const configExtensions = [
			"env",
			"config",
			"ini",
			"toml",
			"json",
			"yml",
			"yaml",
		];
		return this.data.extension
			? configExtensions.includes(this.data.extension)
			: false;
	}

	/**
	 * 获取父目录路径
	 */
	getParentPath(): string {
		const parts = this.data.path.split("/").filter((p) => p.length > 0);
		parts.pop(); // 移除文件名
		return parts.length > 0 ? "/" + parts.join("/") : "/";
	}

	/**
	 * 获取文件名（不含扩展名）
	 */
	getBaseName(): string {
		if (!this.data.extension) return this.data.name;
		const extIndex = this.data.name.lastIndexOf(".");
		return extIndex > 0
			? this.data.name.substring(0, extIndex)
			: this.data.name;
	}

	/**
	 * 便捷访问器
	 */
	get name(): string {
		return this.data.name;
	}
	get path(): string {
		return this.data.path;
	}
	get isDirectory(): boolean {
		return this.data.isDirectory;
	}
	get size(): number {
		return this.data.size || 0;
	}
	get modified(): string {
		return this.data.modified || "";
	}
	get extension(): string | undefined {
		return this.data.extension;
	}
	get permissions(): string | undefined {
		return this.data.permissions;
	}
}
