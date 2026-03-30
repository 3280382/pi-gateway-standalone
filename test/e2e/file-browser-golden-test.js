/**
 * 文件浏览器黄金标准测试
 * 按照FEATURES.md验证所有功能
 */

import fs from "fs";
import fetch from "node-fetch";
import path from "path";

const BASE_URL = "http://127.0.0.1:5173";
const API_URL = "http://127.0.0.1:3000";

class FileBrowserGoldenTest {
	constructor() {
		this.passed = 0;
		this.failed = 0;
		this.results = [];
	}

	log(name, success, details = "") {
		const status = success ? "✅" : "❌";
		console.log(`  ${status} ${name}`);
		if (details) console.log(`     ${details}`);

		if (success) this.passed++;
		else {
			this.failed++;
			this.results.push(`${name}: ${details}`);
		}
		return success;
	}

	async testAPIEndpoints() {
		console.log("\n📡 API端点测试");

		// 1. 版本API
		try {
			const res = await fetch(`${API_URL}/api/version`);
			const data = await res.json();
			this.log(
				"GET /api/version",
				res.ok && data.version,
				`版本: ${data.version}`,
			);
		} catch (e) {
			this.log("GET /api/version", false, e.message);
		}

		// 2. 浏览目录 /root
		try {
			const res = await fetch(`${API_URL}/api/browse`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path: "/root" }),
			});
			const data = await res.json();
			this.log(
				"POST /api/browse (/root)",
				res.ok && data.currentPath === "/root",
				`${data.items?.length || 0} 个项目`,
			);
		} catch (e) {
			this.log("POST /api/browse (/root)", false, e.message);
		}

		// 3. 浏览根目录
		try {
			const res = await fetch(`${API_URL}/api/browse`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path: "/" }),
			});
			const data = await res.json();
			this.log(
				"POST /api/browse (/)",
				res.ok,
				`${data.items?.length || 0} 个项目`,
			);
		} catch (e) {
			this.log("POST /api/browse (/)", false, e.message);
		}

		// 4. 执行API
		try {
			const res = await fetch(`${API_URL}/api/execute`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					command: 'echo "test"',
					cwd: "/root",
					streaming: true,
				}),
			});
			this.log("POST /api/execute", res.ok, `HTTP ${res.status}`);
		} catch (e) {
			this.log("POST /api/execute", false, e.message);
		}

		// 5. 读取文件API
		try {
			const res = await fetch(
				`${API_URL}/api/files/content?path=/root/README.md`,
			);
			this.log(
				"GET /api/files/content",
				[200, 404].includes(res.status),
				`HTTP ${res.status}`,
			);
		} catch (e) {
			this.log("GET /api/files/content", false, e.message);
		}
	}

	async testCodeImplementation() {
		console.log("\n📦 代码实现验证");

		const checks = [
			{
				name: "FileBrowser主组件",
				file: "src/client/components/files/FileBrowser.tsx",
				patterns: [
					"export function FileBrowser",
					"FileSidebar",
					"FileToolbar",
					"FileViewer",
				],
			},
			{
				name: "FileSidebar侧边栏",
				file: "src/client/components/files/FileSidebar.tsx",
				patterns: [
					"export function FileSidebar",
					"visible",
					"loadDirectory",
					"TreeCache",
				],
			},
			{
				name: "FileViewer查看器",
				file: "src/client/components/files/FileViewer.tsx",
				patterns: [
					"export function FileViewer",
					"isOpen",
					"mode",
					"readFile",
					"writeFile",
				],
			},
			{
				name: "FileList文件列表",
				file: "src/client/components/files/FileList.tsx",
				patterns: ["export function FileList", "FileItem", "selectForAction"],
			},
			{
				name: "FileActionBar操作栏",
				file: "src/client/components/files/FileActionBar.tsx",
				patterns: [
					"export function FileActionBar",
					"executeFile",
					"selectedActionFile",
				],
			},
			{
				name: "FileToolbar工具栏",
				file: "src/client/components/files/FileToolbar.tsx",
				patterns: ["export function FileToolbar", "viewMode", "toggleViewMode"],
			},
			{
				name: "fileApi服务",
				file: "src/client/services/api/fileApi.ts",
				patterns: [
					"browseDirectory",
					"readFile",
					"writeFile",
					"executeFile",
					"formatFileSize",
				],
			},
			{
				name: "fileStore状态管理",
				file: "src/client/stores/fileStore.ts",
				patterns: [
					"useFileStore",
					"currentPath",
					"setItems",
					"getFilteredAndSortedItems",
					"executeFile",
				],
			},
			{
				name: "fileViewerStore查看器状态",
				file: "src/client/stores/fileViewerStore.ts",
				patterns: [
					"useFileViewerStore",
					"isOpen",
					"openViewer",
					"closeViewer",
					"mode",
				],
			},
		];

		for (const check of checks) {
			const filePath = path.join("/root/pi-gateway-standalone", check.file);
			if (!fs.existsSync(filePath)) {
				this.log(check.name, false, "文件不存在");
				continue;
			}

			const content = fs.readFileSync(filePath, "utf8");
			const missing = check.patterns.filter((p) => !content.includes(p));

			if (missing.length === 0) {
				this.log(check.name, true, `${check.patterns.length}项检查通过`);
			} else {
				this.log(check.name, false, `缺少: ${missing.join(", ")}`);
			}
		}
	}

	async testCSSImplementation() {
		console.log("\n🎨 CSS样式验证");

		const cssPath = "src/client/components/files/FileBrowser.module.css";
		const fullPath = path.join("/root/pi-gateway-standalone", cssPath);

		if (!fs.existsSync(fullPath)) {
			this.log("CSS文件存在", false, "文件不存在");
			return;
		}

		const content = fs.readFileSync(fullPath, "utf8");

		const checks = [
			{ name: "文件浏览器容器", pattern: ".fileBrowserSection" },
			{ name: "侧边栏overlay样式", pattern: ".sidebar { position: fixed" },
			{ name: "侧边栏隐藏", pattern: "transform: translateX(-100%)" },
			{
				name: "侧边栏显示",
				pattern: ".sidebar.visible { transform: translateX(0)",
			},
			{ name: "z-index层级", pattern: "z-index: 900" },
			{ name: "滚动支持", pattern: "overflow: auto" },
			{ name: "文件列表区域", pattern: ".contentArea" },
			{ name: "工具栏样式", pattern: ".toolbar" },
			{ name: "动画过渡", pattern: "transition" },
		];

		for (const check of checks) {
			const found = content.includes(check.pattern);
			this.log(`CSS: ${check.name}`, found);
		}
	}

	async testFeatureImplementation() {
		console.log("\n✨ 特性功能验证");

		const storePath = path.join(
			"/root/pi-gateway-standalone",
			"src/client/stores/fileStore.ts",
		);
		const content = fs.readFileSync(storePath, "utf8");

		// 特性检查
		const features = [
			{ name: "目录树浏览", check: () => content.includes("currentPath") },
			{ name: "异步加载", check: () => content.includes("setLoading") },
			{
				name: "文件排序",
				check: () =>
					content.includes("sortMode") &&
					content.includes("getFilteredAndSortedItems"),
			},
			{
				name: "文件过滤",
				check: () =>
					content.includes("filterText") || content.includes("filterType"),
			},
			{
				name: "文件预览",
				check: () =>
					fs.existsSync(
						"/root/pi-gateway-standalone/src/client/stores/fileViewerStore.ts",
					),
			},
			{
				name: "文件编辑",
				check: () => {
					const viewerContent = fs.readFileSync(
						"/root/pi-gateway-standalone/src/client/components/files/FileViewer.tsx",
						"utf8",
					);
					return (
						viewerContent.includes("edit") && viewerContent.includes("save")
					);
				},
			},
			{ name: "文件执行", check: () => content.includes("executeFile") },
			{
				name: "批量选择",
				check: () =>
					content.includes("selectedItems") ||
					content.includes("toggleSelection"),
			},
			{
				name: "底部面板集成",
				check: () =>
					content.includes("onOpenBottomPanel") ||
					content.includes("onExecuteOutput"),
			},
		];

		for (const feature of features) {
			const implemented = feature.check();
			this.log(`特性: ${feature.name}`, implemented);
		}
	}

	async testFrontendAccess() {
		console.log("\n🌐 前端访问验证");

		// 1. 首页访问
		try {
			const res = await fetch(`${BASE_URL}/`);
			this.log(
				"首页访问",
				res.ok,
				`HTTP ${res.status}, ${(await res.text()).length} bytes`,
			);
		} catch (e) {
			this.log("首页访问", false, e.message);
		}

		// 2. 关键组件文件访问
		const files = [
			"src/client/components/files/FileBrowser.tsx",
			"src/client/components/files/FileSidebar.tsx",
			"src/client/components/files/FileViewer.tsx",
		];

		for (const file of files) {
			try {
				const res = await fetch(`${BASE_URL}/${file}`);
				this.log(
					`组件访问: ${path.basename(file)}`,
					res.ok,
					`HTTP ${res.status}`,
				);
			} catch (e) {
				this.log(`组件访问: ${path.basename(file)}`, false, e.message);
			}
		}
	}

	async testDataStructure() {
		console.log("\n📊 数据结构验证");

		try {
			const res = await fetch(`${API_URL}/api/browse`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path: "/root" }),
			});

			const data = await res.json();

			// 验证数据结构
			const checks = [
				{
					name: "currentPath字段",
					test: () => typeof data.currentPath === "string",
				},
				{
					name: "parentPath字段",
					test: () => typeof data.parentPath === "string",
				},
				{ name: "items数组", test: () => Array.isArray(data.items) },
				{
					name: "items项有name",
					test: () =>
						data.items.length === 0 || typeof data.items[0].name === "string",
				},
				{
					name: "items项有path",
					test: () =>
						data.items.length === 0 || typeof data.items[0].path === "string",
				},
				{
					name: "items项有isDirectory",
					test: () =>
						data.items.length === 0 ||
						typeof data.items[0].isDirectory === "boolean",
				},
			];

			for (const check of checks) {
				const result = check.test();
				this.log(`数据结构: ${check.name}`, result);
			}
		} catch (e) {
			this.log("数据结构验证", false, e.message);
		}
	}

	async testIntegration() {
		console.log("\n🔗 集成验证");

		// 验证前后端集成
		try {
			// 1. 前端服务
			const frontendRes = await fetch(`${BASE_URL}/`);
			const frontendOk = frontendRes.ok;

			// 2. 后端API
			const backendRes = await fetch(`${API_URL}/api/version`);
			const backendOk = backendRes.ok;

			// 3. 文件浏览API
			const browseRes = await fetch(`${API_URL}/api/browse`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path: "/root" }),
			});
			const browseOk = browseRes.ok;

			this.log(
				"前后端服务集成",
				frontendOk && backendOk,
				`前端: ${frontendOk ? "✅" : "❌"}, 后端: ${backendOk ? "✅" : "❌"}`,
			);
			this.log("文件浏览API集成", browseOk);
		} catch (e) {
			this.log("集成验证", false, e.message);
		}
	}

	async run() {
		console.log("=".repeat(70));
		console.log("文件浏览器 - 黄金标准功能验证");
		console.log("=".repeat(70));
		console.log("\n按照 FEATURES.md 要求验证所有功能");
		console.log("验证项目:");
		console.log("  ✓ API端点 (browse, execute, read)");
		console.log("  ✓ 组件实现 (FileBrowser, FileSidebar, FileViewer等)");
		console.log("  ✓ CSS样式 (overlay侧边栏, 动画, 滚动)");
		console.log("  ✓ 特性功能 (浏览, 排序, 过滤, 预览, 编辑, 执行)");
		console.log("  ✓ 数据结构 (API响应格式)");
		console.log("  ✓ 前后端集成");

		await this.testAPIEndpoints();
		await this.testCodeImplementation();
		await this.testCSSImplementation();
		await this.testFeatureImplementation();
		await this.testFrontendAccess();
		await this.testDataStructure();
		await this.testIntegration();

		// Summary
		console.log("\n" + "=".repeat(70));
		console.log("验证结果汇总");
		console.log("=".repeat(70));
		console.log(`✅ 通过: ${this.passed}`);
		console.log(`❌ 失败: ${this.failed}`);
		console.log(`📊 总计: ${this.passed + this.failed}`);
		console.log(
			`🎯 成功率: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`,
		);

		if (this.failed === 0) {
			console.log("\n🎉 所有验证通过！文件浏览器功能完整实现。");
		} else {
			console.log(`\n⚠️ 有 ${this.failed} 项验证未通过，需要修复。`);
			console.log("\n失败项列表:");
			this.results.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
		}

		console.log("=".repeat(70));

		return {
			passed: this.passed,
			failed: this.failed,
			total: this.passed + this.failed,
			success: this.failed === 0,
		};
	}
}

// Run test
const test = new FileBrowserGoldenTest();
test
	.run()
	.then((result) => {
		process.exit(result.success ? 0 : 1);
	})
	.catch((error) => {
		console.error("测试运行错误:", error);
		process.exit(1);
	});
