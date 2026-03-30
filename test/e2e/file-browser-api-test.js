/**
 * 文件浏览器API和状态验证测试
 * 不依赖浏览器，直接测试API和代码逻辑
 */

import fs from "fs";
import fetch from "node-fetch";
import path from "path";

const BASE_URL = "http://127.0.0.1:5173";
const API_URL = "http://127.0.0.1:3000";

class FileBrowserTest {
	constructor() {
		this.results = [];
		this.passed = 0;
		this.failed = 0;
	}

	async log(testName, success, details = "") {
		const status = success ? "✅" : "❌";
		console.log(`   ${status} ${testName}`);
		if (details) {
			console.log(`      ${details}`);
		}

		if (success) {
			this.passed++;
		} else {
			this.failed++;
			this.results.push(`${testName}: ${details}`);
		}
	}

	async testAPIEndpoints() {
		console.log("\n📡 API端点测试:");

		// Test 1: 版本API
		try {
			const response = await fetch(`${API_URL}/api/version`);
			const data = await response.json();
			await this.log(
				"GET /api/version",
				response.ok && data.version,
				`版本: ${data.version || "N/A"}`,
			);
		} catch (error) {
			await this.log("GET /api/version", false, error.message);
		}

		// Test 2: 浏览根目录
		try {
			const response = await fetch(`${API_URL}/api/browse`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path: "/" }),
			});
			const data = await response.json();
			await this.log(
				"POST /api/browse (/)",
				response.ok && Array.isArray(data.items),
				`${data.items?.length || 0} 个项目`,
			);
		} catch (error) {
			await this.log("POST /api/browse (/)", false, error.message);
		}

		// Test 3: 浏览/root目录
		try {
			const response = await fetch(`${API_URL}/api/browse`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path: "/root" }),
			});
			const data = await response.json();
			await this.log(
				"POST /api/browse (/root)",
				response.ok && data.currentPath === "/root",
				`当前路径: ${data.currentPath}, ${data.items?.length || 0} 个项目`,
			);
		} catch (error) {
			await this.log("POST /api/browse (/root)", false, error.message);
		}

		// Test 4: 执行API
		try {
			const response = await fetch(`${API_URL}/api/execute`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					command: 'echo "test"',
					cwd: "/root",
					streaming: true,
				}),
			});
			await this.log(
				"POST /api/execute",
				response.ok,
				`状态: ${response.status}`,
			);
		} catch (error) {
			await this.log("POST /api/execute", false, error.message);
		}
	}

	async testCodeIntegrity() {
		console.log("\n📦 代码完整性测试:");

		const checks = [
			{
				name: "FileBrowser组件存在",
				path: "src/client/components/files/FileBrowser.tsx",
				checks: ["export function FileBrowser", "FileSidebar", "FileToolbar"],
			},
			{
				name: "FileSidebar组件存在",
				path: "src/client/components/files/FileSidebar.tsx",
				checks: [
					"export function FileSidebar",
					"visible: boolean",
					"loadDirectory",
				],
			},
			{
				name: "FileViewer组件存在",
				path: "src/client/components/files/FileViewer.tsx",
				checks: ["export function FileViewer", "isOpen", "mode"],
			},
			{
				name: "fileApi服务存在",
				path: "src/client/services/api/fileApi.ts",
				checks: ["browseDirectory", "readFile", "writeFile", "executeFile"],
			},
			{
				name: "fileStore状态管理",
				path: "src/client/stores/fileStore.ts",
				checks: [
					"useFileStore",
					"currentPath",
					"setItems",
					"getFilteredAndSortedItems",
				],
			},
		];

		for (const check of checks) {
			const filePath = path.join("/root/pi-gateway-standalone", check.path);

			if (!fs.existsSync(filePath)) {
				await this.log(check.name, false, "文件不存在");
				continue;
			}

			const content = fs.readFileSync(filePath, "utf8");
			const missing = check.checks.filter(
				(pattern) => !content.includes(pattern),
			);

			if (missing.length === 0) {
				await this.log(
					check.name,
					true,
					`${check.checks.length}/${check.checks.length} 检查点通过`,
				);
			} else {
				await this.log(check.name, false, `缺少: ${missing.join(", ")}`);
			}
		}
	}

	async testCSSStyles() {
		console.log("\n🎨 CSS样式测试:");

		const cssPath = "src/client/components/files/FileBrowser.module.css";
		const fullPath = path.join("/root/pi-gateway-standalone", cssPath);

		if (!fs.existsSync(fullPath)) {
			await this.log("CSS文件存在", false, "文件不存在");
			return;
		}

		const content = fs.readFileSync(fullPath, "utf8");

		const styleChecks = [
			{ name: "侧边栏overlay样式", pattern: ".sidebar { position: fixed" },
			{ name: "侧边栏隐藏状态", pattern: "transform: translateX(-100%)" },
			{
				name: "侧边栏显示状态",
				pattern: ".sidebar.visible { transform: translateX(0)",
			},
			{ name: "滚动支持", pattern: "overflow: auto" },
			{ name: "z-index层级", pattern: "z-index: 900" },
		];

		for (const check of styleChecks) {
			const found = content.includes(check.pattern);
			await this.log(check.name, found, found ? "样式正确" : "样式缺失");
		}
	}

	async testStateFlow() {
		console.log("\n🔄 状态流测试:");

		const storePath = "src/client/stores/fileStore.ts";
		const fullPath = path.join("/root/pi-gateway-standalone", storePath);

		if (!fs.existsSync(fullPath)) {
			await this.log("状态管理存在", false, "文件不存在");
			return;
		}

		const content = fs.readFileSync(fullPath, "utf8");

		// 检查初始状态
		const hasRootPath = content.includes('currentPath: "/root"');
		await this.log(
			"初始路径为/root",
			hasRootPath,
			hasRootPath ? "配置正确" : "配置错误",
		);

		// 检查关键方法
		const methods = [
			"setItems",
			"setCurrentPath",
			"getFilteredAndSortedItems",
			"selectForAction",
		];
		for (const method of methods) {
			const found = content.includes(method);
			await this.log(`方法 ${method}()`, found, found ? "已定义" : "未定义");
		}
	}

	async testFrontendAccessibility() {
		console.log("\n🌐 前端可访问性测试:");

		// Test 1: 前端服务响应
		try {
			const response = await fetch(`${BASE_URL}/`);
			await this.log("前端服务响应", response.ok, `HTTP ${response.status}`);
		} catch (error) {
			await this.log("前端服务响应", false, error.message);
		}

		// Test 2: 关键文件可访问
		const files = [
			"src/client/components/files/FileBrowser.tsx",
			"src/client/components/files/FileSidebar.tsx",
			"src/client/services/api/fileApi.ts",
		];

		for (const file of files) {
			try {
				const response = await fetch(`${BASE_URL}/${file}`);
				await this.log(
					`文件访问 ${path.basename(file)}`,
					response.ok,
					`HTTP ${response.status}`,
				);
			} catch (error) {
				await this.log(`文件访问 ${path.basename(file)}`, false, error.message);
			}
		}
	}

	async testDataFlow() {
		console.log("\n📊 数据流验证:");

		// 验证API数据结构与组件期望匹配
		try {
			const response = await fetch(`${API_URL}/api/browse`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path: "/root" }),
			});

			const data = await response.json();

			// 验证数据结构
			const checks = [
				{
					name: "有currentPath",
					test: () => typeof data.currentPath === "string",
				},
				{
					name: "有parentPath",
					test: () => typeof data.parentPath === "string",
				},
				{ name: "有items数组", test: () => Array.isArray(data.items) },
				{
					name: "items有name属性",
					test: () =>
						data.items.length === 0 || typeof data.items[0].name === "string",
				},
				{
					name: "items有path属性",
					test: () =>
						data.items.length === 0 || typeof data.items[0].path === "string",
				},
				{
					name: "items有isDirectory",
					test: () =>
						data.items.length === 0 ||
						typeof data.items[0].isDirectory === "boolean",
				},
			];

			for (const check of checks) {
				const result = check.test();
				await this.log(`数据结构: ${check.name}`, result);
			}
		} catch (error) {
			await this.log("数据流验证", false, error.message);
		}
	}

	async run() {
		console.log("=".repeat(70));
		console.log("文件浏览器 - 综合API和状态测试");
		console.log("=".repeat(70));

		await this.testAPIEndpoints();
		await this.testCodeIntegrity();
		await this.testCSSStyles();
		await this.testStateFlow();
		await this.testFrontendAccessibility();
		await this.testDataFlow();

		// Summary
		console.log("\n" + "=".repeat(70));
		console.log("测试结果汇总");
		console.log("=".repeat(70));
		console.log(`✅ 通过: ${this.passed}`);
		console.log(`❌ 失败: ${this.failed}`);
		console.log(`📊 总计: ${this.passed + this.failed}`);
		console.log(
			`🎯 成功率: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`,
		);

		if (this.failed > 0) {
			console.log("\n❌ 失败项:");
			this.results.forEach((r, i) => console.log(`   ${i + 1}. ${r}`));
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

// Run tests
const test = new FileBrowserTest();
test.run().catch((error) => {
	console.error("测试运行错误:", error);
	process.exit(1);
});
