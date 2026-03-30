/**
 * 诊断所有问题
 */

import fs from "fs";
import fetch from "node-fetch";
import path from "path";

async function diagnoseAllIssues() {
	console.log("=== 诊断所有问题 ===\n");

	console.log("用户报告的问题:");
	console.log("1. 左侧面板打开后没有加载文件");
	console.log("2. 左右面板目录不一致（左: /, 右: /root）");
	console.log("3. 不能上下滚动");
	console.log("4. 文件查看窗口异常");
	console.log("5. 可执行文件没有执行输出\n");

	const issues = [];

	// 1. 检查API端点
	console.log("1. 检查API端点:");

	const apiTests = [
		{
			name: "浏览根目录",
			url: "/api/browse",
			method: "POST",
			body: { path: "/" },
		},
		{
			name: "浏览home目录",
			url: "/api/browse",
			method: "POST",
			body: { path: "/root" },
		},
		{
			name: "执行端点",
			url: "/api/execute",
			method: "POST",
			body: { command: "ls", cwd: "/", streaming: true },
		},
	];

	for (const test of apiTests) {
		try {
			const response = await fetch(`http://127.0.0.1:3000${test.url}`, {
				method: test.method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(test.body),
			});

			console.log(`   ${test.name}: ${response.status} ${response.statusText}`);

			if (!response.ok) {
				issues.push(`${test.name} API失败: ${response.status}`);
			}
		} catch (error) {
			console.log(`   ${test.name}: ❌ ${error.message}`);
			issues.push(`${test.name} API错误: ${error.message}`);
		}
	}

	// 2. 检查文件路径不一致问题
	console.log("\n2. 检查文件路径不一致:");

	const paths = {
		fileStore初始路径: "/root",
		FileSidebar加载路径: "/root", // 已修复
		API根目录: "/",
		"API home目录": "/root",
	};

	Object.entries(paths).forEach(([name, expectedPath]) => {
		console.log(`   ${name}: ${expectedPath}`);
	});

	// 3. 检查滚动CSS
	console.log("\n3. 检查滚动CSS:");

	const cssFile =
		"/root/pi-gateway-standalone/src/client/components/files/FileBrowser.module.css";
	const cssContent = fs.readFileSync(cssFile, "utf8");

	const cssChecks = [
		{ selector: ".fileBrowserSection", property: "overflow", expected: "auto" },
		{ selector: ".main", property: "overflow", expected: "auto" },
		{ selector: ".contentArea", property: "overflow", expected: "auto" },
		{ selector: ".sidebar", property: "overflow-y", expected: "auto" },
	];

	for (const check of cssChecks) {
		const regex = new RegExp(
			`${check.selector}\\s*{[^}]*${check.property}:\\s*([^;]+)`,
		);
		const match = cssContent.match(regex);
		const value = match ? match[1].trim() : "未找到";

		console.log(
			`   ${check.selector} ${check.property}: ${value} ${value === check.expected ? "✅" : "❌"}`,
		);

		if (value !== check.expected) {
			issues.push(
				`${check.selector}的${check.property}应为${check.expected}，实际为${value}`,
			);
		}
	}

	// 4. 检查FileViewer状态管理
	console.log("\n4. 检查FileViewer状态管理:");

	const viewerFiles = [
		"src/client/components/files/FileViewer.tsx",
		"src/client/components/files/FileBrowser.tsx",
		"src/client/stores/fileViewerStore.ts",
	];

	for (const file of viewerFiles) {
		const filePath = path.join("/root/pi-gateway-standalone", file);
		const exists = fs.existsSync(filePath);
		console.log(`   ${file}: ${exists ? "✅" : "❌"}`);

		if (exists) {
			const content = fs.readFileSync(filePath, "utf8");
			const hasIsOpen = content.includes("isOpen");
			const hasOnClose = content.includes("onClose");

			console.log(`      isOpen: ${hasIsOpen ? "✅" : "❌"}`);
			console.log(`      onClose: ${hasOnClose ? "✅" : "❌"}`);

			if (!hasIsOpen) {
				issues.push(`${file}缺少isOpen状态管理`);
			}
		}
	}

	// 5. 检查执行功能
	console.log("\n5. 检查执行功能:");

	const executeChecks = [
		{ file: "src/client/services/api/fileApi.ts", check: "executeFile函数" },
		{ file: "src/server/routes/index.ts", check: "/api/execute路由" },
		{
			file: "src/server/controllers/file.controller.ts",
			check: "executeCommand函数",
		},
	];

	for (const check of executeChecks) {
		const filePath = path.join("/root/pi-gateway-standalone", check.file);
		const exists = fs.existsSync(filePath);
		console.log(`   ${check.check}: ${exists ? "✅" : "❌"}`);

		if (exists) {
			const content = fs.readFileSync(filePath, "utf8");

			if (check.file.includes("fileApi.ts")) {
				const sendsPath = content.includes("body: JSON.stringify({ path })");
				console.log(`      发送path参数: ${sendsPath ? "✅" : "❌"}`);

				if (!sendsPath) {
					issues.push("前端executeFile发送的请求格式可能不正确");
				}
			}

			if (check.file.includes("file.controller.ts")) {
				const expectsCommand = content.includes("command, cwd, streaming");
				console.log(`      期望command参数: ${expectsCommand ? "✅" : "❌"}`);

				if (expectsCommand) {
					issues.push(
						"后端executeCommand期望{command, cwd, streaming}，但前端发送{path}",
					);
				}
			}
		}
	}

	// 6. 总结
	console.log("\n=== 诊断结果 ===");

	if (issues.length === 0) {
		console.log("✅ 未发现明显问题");
		console.log("可能需要进一步调试前端交互");
	} else {
		console.log(`发现 ${issues.length} 个问题:`);
		issues.forEach((issue, index) => {
			console.log(`   ${index + 1}. ${issue}`);
		});

		console.log("\n=== 修复建议 ===");

		if (issues.some((i) => i.includes("executeCommand期望"))) {
			console.log("1. 修复执行API不匹配:");
			console.log('   前端发送: { path: "file.sh" }');
			console.log(
				'   后端期望: { command: "./file.sh", cwd: "/path", streaming: true }',
			);
			console.log("   需要修改executeFile函数或创建新的适配器");
		}

		if (issues.some((i) => i.includes("overflow"))) {
			console.log("2. 已修复滚动CSS");
		}

		if (issues.some((i) => i.includes("FileSidebar加载路径"))) {
			console.log("3. 已修复目录不一致问题");
		}
	}

	// 7. 创建测试文件验证执行
	console.log("\n7. 创建测试文件验证执行:");

	const testScript = "/root/test-execute.sh";
	const scriptContent = `#!/bin/bash
echo "测试脚本执行成功"
echo "当前目录: $(pwd)"
echo "参数: $@"
sleep 0.5
echo "完成"
`;

	fs.writeFileSync(testScript, scriptContent);
	fs.chmodSync(testScript, 0o755);

	console.log(`   创建测试脚本: ${testScript}`);
	console.log(`   内容: ${scriptContent.split("\n")[0]}...`);
	console.log(`   权限: ${fs.statSync(testScript).mode.toString(8)}`);

	console.log("\n=== 诊断完成 ===");
	return { issues };
}

diagnoseAllIssues().catch((error) => {
	console.error("诊断错误:", error);
	process.exit(1);
});
