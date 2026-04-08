/**
 * TreeViewModal 测试 - 验证层级缩进功能
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	escapeRegExp,
	filterTreeNodes,
	flattenTree,
	generateTreeText,
	getFileIcon,
	type TreeNode,
	TreeViewModal,
} from "./TreeViewModal";

// Mock CSS
vi.mock("./TreeViewModal.module.css", () => ({
	default: {
		overlay: "overlay",
		modal: "modal",
		header: "header",
		headerRow: "headerRow",
		title: "title",
		closeBtn: "closeBtn",
		select: "select",
		searchInput: "searchInput",
		copyBtn: "copyBtn",
		copied: "copied",
		content: "content",
		message: "message",
		tree: "tree",
		node: "node",
		connector: "connector",
		expandIcon: "expandIcon",
		icon: "icon",
		dirName: "dirName",
		fileName: "fileName",
		highlight: "highlight",
	},
}));

// Mock clipboard
const mockClipboard = {
	writeText: vi.fn().mockResolvedValue(undefined),
};
Object.assign(navigator, { clipboard: mockClipboard });

// 测试数据
const createTestTree = (): { path: string; items: TreeNode[] } => ({
	path: "/project",
	items: [
		{
			path: "/project/src",
			name: "src",
			isDirectory: true,
			children: [
				{
					path: "/project/src/components",
					name: "components",
					isDirectory: true,
					children: [
						{
							path: "/project/src/components/Button.tsx",
							name: "Button.tsx",
							isDirectory: false,
						},
						{
							path: "/project/src/components/Input.tsx",
							name: "Input.tsx",
							isDirectory: false,
						},
					],
				},
				{
					path: "/project/src/utils.ts",
					name: "utils.ts",
					isDirectory: false,
				},
			],
		},
		{
			path: "/project/package.json",
			name: "package.json",
			isDirectory: false,
		},
		{
			path: "/project/node_modules",
			name: "node_modules",
			isDirectory: true,
			children: [
				{
					path: "/project/node_modules/react",
					name: "react",
					isDirectory: true,
				},
			],
		},
		{
			path: "/project/.git",
			name: ".git",
			isDirectory: true,
			children: [],
		},
	],
});

describe("TreeViewModal", () => {
	const mockOnClose = vi.fn();
	const mockOnFileClick = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("工具函数", () => {
		it("escapeRegExp 应该转义特殊字符", () => {
			expect(escapeRegExp("test.txt")).toBe("test\\.txt");
			expect(escapeRegExp("file[1].js")).toBe("file\\[1\\]\\.js");
			expect(escapeRegExp("a*b+c?")).toBe("a\\*b\\+c\\?");
		});

		it("getFileIcon 应该返回正确的图标", () => {
			expect(getFileIcon("dir", true)).toBe("📁");
			expect(getFileIcon("index.js", false)).toBe("📜");
			expect(getFileIcon("styles.css", false)).toBe("🎨");
			expect(getFileIcon("readme.md", false)).toBe("📝");
			expect(getFileIcon("unknown.xyz", false)).toBe("📄");
		});

		it("filterTreeNodes 应该正确过滤节点", () => {
			const tree = createTestTree().items;

			// 正常模式 - 排除 node_modules 和 .git
			const normal = filterTreeNodes(tree, "normal", "");
			expect(normal.length).toBe(2);
			expect(normal.some((n) => n.name === "src")).toBe(true);
			expect(normal.some((n) => n.name === "package.json")).toBe(true);
			expect(normal.some((n) => n.name === "node_modules")).toBe(false);
			expect(normal.some((n) => n.name === ".git")).toBe(false);

			// 全部模式
			const all = filterTreeNodes(tree, "all", "");
			expect(all.length).toBe(4);

			// 搜索模式 - 返回包含匹配项的完整树路径
			const search = filterTreeNodes(tree, "search", "Button");
			expect(search.length).toBe(1);
			expect(search[0].name).toBe("src"); // 返回根节点，包含匹配的路径
			expect(search[0].children?.[0].name).toBe("components");
			expect(search[0].children?.[0].children?.[0].name).toBe("Button.tsx");
		});

		it("flattenTree 应该正确扁平化树结构", () => {
			const tree = createTestTree().items.slice(0, 1); // 只取 src
			const expanded = new Set(["/project/src", "/project/src/components"]);
			const flat = flattenTree(tree, expanded);

			// src (level 0)
			expect(flat[0].node.name).toBe("src");
			expect(flat[0].level).toBe(0);
			expect(flat[0].parentLastStack).toEqual([]);

			// components (level 1) - src 的第一个子节点
			expect(flat[1].node.name).toBe("components");
			expect(flat[1].level).toBe(1);
			expect(flat[1].parentLastStack).toEqual([true]); // src 的 isLast

			// Button.tsx (level 2) - components 的第一个子节点
			expect(flat[2].node.name).toBe("Button.tsx");
			expect(flat[2].level).toBe(2);
			expect(flat[2].parentLastStack).toEqual([true, false]); // src 和 components 的 isLast

			// Input.tsx (level 2) - components 的最后一个子节点
			expect(flat[3].node.name).toBe("Input.tsx");
			expect(flat[3].level).toBe(2);
			expect(flat[3].parentLastStack).toEqual([true, false]); // 注意：不包含 Input.tsx 自己的 isLast

			// utils.ts (level 1) - src 的最后一个子节点
			expect(flat[4].node.name).toBe("utils.ts");
			expect(flat[4].level).toBe(1);
			expect(flat[4].parentLastStack).toEqual([true]); // src 的 isLast
		});

		it("generateTreeText 应该生成正确的树形文本", () => {
			const tree = createTestTree().items.slice(0, 1);
			const text = generateTreeText(tree);

			expect(text).toContain("src");
			expect(text).toContain("├──");
			expect(text).toContain("└──");
		});
	});

	describe("组件渲染", () => {
		it("isOpen=false 时不应该渲染", () => {
			render(
				<TreeViewModal
					isOpen={false}
					treeData={createTestTree()}
					treeLoading={false}
					onClose={mockOnClose}
					onFileClick={mockOnFileClick}
				/>,
			);
			expect(screen.queryByText("/project")).not.toBeInTheDocument();
		});

		it("应该显示加载状态", () => {
			render(
				<TreeViewModal
					isOpen={true}
					treeData={createTestTree()}
					treeLoading={true}
					onClose={mockOnClose}
					onFileClick={mockOnFileClick}
				/>,
			);
			expect(screen.getByText("Loading...")).toBeInTheDocument();
		});

		it("应该显示空状态", () => {
			render(
				<TreeViewModal
					isOpen={true}
					treeData={{ path: "/empty", items: [] }}
					treeLoading={false}
					onClose={mockOnClose}
					onFileClick={mockOnFileClick}
				/>,
			);
			expect(screen.getByText("无内容")).toBeInTheDocument();
		});

		it("应该渲染树结构", () => {
			render(
				<TreeViewModal
					isOpen={true}
					treeData={createTestTree()}
					treeLoading={false}
					onClose={mockOnClose}
					onFileClick={mockOnFileClick}
				/>,
			);

			expect(screen.getByText("/project")).toBeInTheDocument();
			expect(screen.getByText("src")).toBeInTheDocument();
			expect(screen.getByText("package.json")).toBeInTheDocument();
		});

		it("应该应用正确的层级缩进样式", () => {
			const { container } = render(
				<TreeViewModal
					isOpen={true}
					treeData={createTestTree()}
					treeLoading={false}
					onClose={mockOnClose}
					onFileClick={mockOnFileClick}
				/>,
			);

			const nodes = container.querySelectorAll('[class*="node"]');
			expect(nodes.length).toBeGreaterThan(0);

			// 验证每个节点都有 paddingLeft 样式
			nodes.forEach((node) => {
				const style = (node as HTMLElement).style;
				expect(style.paddingLeft).toBeTruthy();
			});
		});

		it("层级缩进应该随着深度增加", () => {
			// 创建明确的嵌套结构
			const nestedTree = {
				path: "/test",
				items: [
					{
						path: "/test/level0",
						name: "level0",
						isDirectory: true,
						children: [
							{
								path: "/test/level0/level1",
								name: "level1",
								isDirectory: true,
								children: [
									{
										path: "/test/level0/level1/level2.txt",
										name: "level2.txt",
										isDirectory: false,
									},
								],
							},
						],
					},
				],
			};

			const { container } = render(
				<TreeViewModal
					isOpen={true}
					treeData={nestedTree}
					treeLoading={false}
					onClose={mockOnClose}
					onFileClick={mockOnFileClick}
				/>,
			);

			// 找到各层级的节点
			const nodes = Array.from(container.querySelectorAll('[class*="node"]'));

			const level0 = nodes.find((n) => n.textContent?.includes("level0"));
			const level1 = nodes.find((n) => n.textContent?.includes("level1"));
			const level2 = nodes.find((n) => n.textContent?.includes("level2.txt"));

			expect(level0).toBeTruthy();
			expect(level1).toBeTruthy();
			expect(level2).toBeTruthy();

			// 获取 paddingLeft 值
			const getPadding = (el: Element) =>
				parseInt((el as HTMLElement).style.paddingLeft || "0");

			const p0 = getPadding(level0!);
			const p1 = getPadding(level1!);
			const p2 = getPadding(level2!);

			// 验证缩进递增: 0 < 1 < 2
			expect(p1).toBeGreaterThan(p0);
			expect(p2).toBeGreaterThan(p1);

			// 验证具体数值: level * 24 + 16
			expect(p0).toBe(16); // 0 * 24 + 16
			expect(p1).toBe(40); // 1 * 24 + 16
			expect(p2).toBe(64); // 2 * 24 + 16
		});
	});

	describe("用户交互", () => {
		it("点击关闭按钮应该关闭", () => {
			render(
				<TreeViewModal
					isOpen={true}
					treeData={createTestTree()}
					treeLoading={false}
					onClose={mockOnClose}
					onFileClick={mockOnFileClick}
				/>,
			);

			const closeBtn = screen.getByText("×");
			fireEvent.click(closeBtn);
			expect(mockOnClose).toHaveBeenCalled();
		});

		it("ESC键应该关闭", () => {
			render(
				<TreeViewModal
					isOpen={true}
					treeData={createTestTree()}
					treeLoading={false}
					onClose={mockOnClose}
					onFileClick={mockOnFileClick}
				/>,
			);

			fireEvent.keyDown(window, { key: "Escape" });
			expect(mockOnClose).toHaveBeenCalled();
		});

		it("点击文件应该触发 onFileClick", () => {
			render(
				<TreeViewModal
					isOpen={true}
					treeData={createTestTree()}
					treeLoading={false}
					onClose={mockOnClose}
					onFileClick={mockOnFileClick}
				/>,
			);

			const file = screen.getByText("package.json");
			fireEvent.click(file);
			expect(mockOnFileClick).toHaveBeenCalledWith(
				"/project/package.json",
				"package.json",
			);
		});

		it("复制按钮应该复制树形文本", async () => {
			render(
				<TreeViewModal
					isOpen={true}
					treeData={createTestTree()}
					treeLoading={false}
					onClose={mockOnClose}
					onFileClick={mockOnFileClick}
				/>,
			);

			const copyBtn = screen.getByText("📋 复制");
			fireEvent.click(copyBtn);

			await waitFor(() => {
				expect(mockClipboard.writeText).toHaveBeenCalled();
				expect(screen.getByText("✓ 已复制")).toBeInTheDocument();
			});
		});

		it("搜索应该过滤结果", () => {
			render(
				<TreeViewModal
					isOpen={true}
					treeData={createTestTree()}
					treeLoading={false}
					onClose={mockOnClose}
					onFileClick={mockOnFileClick}
				/>,
			);

			// 切换到搜索模式
			const select = screen.getByDisplayValue("隐藏排除文件");
			fireEvent.change(select, { target: { value: "search" } });

			// 输入搜索词
			const input = screen.getByPlaceholderText("输入过滤文字...");
			fireEvent.change(input, { target: { value: "Button" } });

			// 应该显示匹配的结果
			expect(screen.getByText("Button")).toBeInTheDocument();
		});
	});
});
