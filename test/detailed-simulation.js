/**
 * 详细模拟测试 - 模拟真实用户与文件浏览器的交互
 */

import fetch from "node-fetch";

// 模拟用户操作序列
const USER_SCENARIOS = [
	{
		name: "基本文件浏览",
		steps: [
			{ action: "browse", path: "/root", description: "浏览根目录" },
			{
				action: "browse",
				path: "/root/pi-gateway-standalone",
				description: "浏览项目目录",
			},
			{
				action: "read",
				path: "/root/pi-gateway-standalone/package.json",
				description: "读取package.json",
			},
			{
				action: "browse",
				path: "/root/pi-gateway-standalone/src",
				description: "浏览src目录",
			},
		],
	},
	{
		name: "文件操作流程",
		steps: [
			{
				action: "browse",
				path: "/root/pi-gateway-standalone",
				description: "浏览项目目录",
			},
			{
				action: "find",
				pattern: /\.(js|ts|tsx)$/,
				description: "查找JavaScript/TypeScript文件",
			},
			{ action: "read_sample", count: 2, description: "读取示例文件内容" },
			{ action: "check_executable", description: "检查可执行文件" },
		],
	},
	{
		name: "错误处理",
		steps: [
			{
				action: "browse",
				path: "/non/existent/path",
				description: "尝试浏览不存在的路径",
				expectError: true,
			},
			{
				action: "read",
				path: "/non/existent/file.txt",
				description: "尝试读取不存在的文件",
				expectError: true,
			},
			{ action: "browse", path: "/root", description: "回到正常路径" },
		],
	},
];

async function runScenario(scenario) {
	console.log(`\n运行场景: ${scenario.name}`);
	console.log("=".repeat(40));

	let currentPath = "/root";
	let successCount = 0;
	const totalSteps = scenario.steps.length;

	for (let i = 0; i < scenario.steps.length; i++) {
		const step = scenario.steps[i];
		console.log(`\n步骤 ${i + 1}: ${step.description}`);

		try {
			switch (step.action) {
				case "browse": {
					const browseResult = await browseDirectory(step.path);
					if (browseResult.success) {
						currentPath = browseResult.data.currentPath;
						console.log(`  ✅ 浏览成功: ${currentPath}`);
						console.log(`     找到 ${browseResult.data.items.length} 个项目`);

						// 显示前几个项目
						const sampleItems = browseResult.data.items.slice(0, 3);
						sampleItems.forEach((item) => {
							console.log(
								`     - ${item.name} (${item.isDirectory ? "目录" : "文件"})`,
							);
						});

						if (browseResult.data.items.length > 3) {
							console.log(
								`     ... 还有 ${browseResult.data.items.length - 3} 个项目`,
							);
						}

						successCount++;
					} else {
						if (step.expectError) {
							console.log(`  ✅ 预期错误发生: ${browseResult.error}`);
							successCount++;
						} else {
							console.log(`  ❌ 浏览失败: ${browseResult.error}`);
						}
					}
					break;
				}

				case "read": {
					const readResult = await readFile(step.path);
					if (readResult.success) {
						console.log(
							`  ✅ 读取成功: ${readResult.data.content.length} 字符`,
						);
						console.log(
							`     预览: ${readResult.data.content.substring(0, 80).replace(/\n/g, " ")}...`,
						);
						successCount++;
					} else {
						if (step.expectError) {
							console.log(`  ✅ 预期错误发生: ${readResult.error}`);
							successCount++;
						} else {
							console.log(`  ❌ 读取失败: ${readResult.error}`);
						}
					}
					break;
				}

				case "find": {
					const findResult = await browseDirectory(currentPath);
					if (findResult.success) {
						const matchingFiles = findResult.data.items.filter(
							(item) => !item.isDirectory && step.pattern.test(item.name),
						);
						console.log(
							`  ✅ 查找完成: 找到 ${matchingFiles.length} 个匹配文件`,
						);
						matchingFiles.slice(0, 5).forEach((file) => {
							console.log(`     - ${file.name} (${formatFileSize(file.size)})`);
						});
						successCount++;
					}
					break;
				}

				case "read_sample": {
					const sampleResult = await browseDirectory(currentPath);
					if (sampleResult.success) {
						const files = sampleResult.data.items.filter(
							(item) => !item.isDirectory,
						);
						const samples = files.slice(0, step.count || 2);

						for (const file of samples) {
							const fileResult = await readFile(file.path);
							if (fileResult.success) {
								console.log(
									`  ✅ 读取 ${file.name}: ${fileResult.data.content.length} 字符`,
								);
							}
						}
						successCount++;
					}
					break;
				}

				case "check_executable": {
					const checkResult = await browseDirectory(currentPath);
					if (checkResult.success) {
						const executables = checkResult.data.items.filter(
							(item) => !item.isDirectory && /\.(sh|py|js)$/i.test(item.name),
						);
						console.log(
							`  ✅ 检查完成: 找到 ${executables.length} 个可执行文件`,
						);
						executables.forEach((exe) => {
							console.log(`     - ${exe.name} (${exe.name.split(".").pop()})`);
						});
						successCount++;
					}
					break;
				}
			}
		} catch (error) {
			console.log(`  ❌ 步骤执行错误: ${error.message}`);
		}

		// 短暂延迟，模拟用户思考时间
		await delay(500);
	}

	const successRate = (successCount / totalSteps) * 100;
	console.log(
		`\n场景完成: ${successCount}/${totalSteps} 步骤成功 (${successRate.toFixed(1)}%)`,
	);

	return { successCount, totalSteps, successRate };
}

async function browseDirectory(path) {
	try {
		const response = await fetch("http://127.0.0.1:3000/api/browse", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path }),
		});

		if (response.ok) {
			const data = await response.json();
			return { success: true, data };
		} else {
			const errorText = await response.text();
			return {
				success: false,
				error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`,
			};
		}
	} catch (error) {
		return { success: false, error: error.message };
	}
}

async function readFile(path) {
	try {
		const response = await fetch(
			`http://127.0.0.1:3000/api/files/content?path=${encodeURIComponent(path)}`,
		);

		if (response.ok) {
			const data = await response.json();
			return { success: true, data };
		} else {
			const errorText = await response.text();
			return {
				success: false,
				error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`,
			};
		}
	} catch (error) {
		return { success: false, error: error.message };
	}
}

function formatFileSize(bytes) {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / k ** i).toFixed(2)) + " " + sizes[i];
}

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDetailedSimulation() {
	console.log("=== 详细用户交互模拟测试 ===");
	console.log("模拟真实用户与文件浏览器的交互\n");

	const startTime = Date.now();
	const results = [];

	// 首先检查服务状态
	console.log("1. 检查服务状态...");
	try {
		const versionResponse = await fetch("http://127.0.0.1:3000/api/version");
		if (versionResponse.ok) {
			const versionData = await versionResponse.json();
			console.log(`   ✅ 后端服务正常: Node.js ${versionData.nodeVersion}`);
		}

		const frontendResponse = await fetch("http://127.0.0.1:5173/");
		console.log(`   ✅ 前端服务正常: HTTP ${frontendResponse.status}`);
	} catch (error) {
		console.log(`   ❌ 服务检查失败: ${error.message}`);
		return;
	}

	// 运行所有场景
	for (const scenario of USER_SCENARIOS) {
		const scenarioResult = await runScenario(scenario);
		results.push({
			name: scenario.name,
			...scenarioResult,
		});
	}

	// 总结
	const totalTime = (Date.now() - startTime) / 1000;
	console.log("\n" + "=".repeat(50));
	console.log("=== 测试总结 ===");
	console.log(`总测试时间: ${totalTime.toFixed(1)} 秒`);
	console.log(`测试场景: ${results.length} 个`);

	let totalSteps = 0;
	let totalSuccess = 0;

	results.forEach((result) => {
		console.log(`\n${result.name}:`);
		console.log(
			`  成功率: ${result.successRate.toFixed(1)}% (${result.successCount}/${result.totalSteps})`,
		);
		totalSteps += result.totalSteps;
		totalSuccess += result.successCount;
	});

	const overallRate = (totalSuccess / totalSteps) * 100;
	console.log(
		`\n总体成功率: ${overallRate.toFixed(1)}% (${totalSuccess}/${totalSteps})`,
	);

	// 评估
	console.log("\n=== 评估 ===");
	if (overallRate >= 90) {
		console.log("✅ 优秀: 文件浏览器核心功能工作正常");
		console.log("   建议: 进行UI/UX测试和性能优化");
	} else if (overallRate >= 70) {
		console.log("⚠️ 一般: 基本功能工作，但有一些问题");
		console.log("   建议: 修复失败的功能步骤");
	} else if (overallRate >= 50) {
		console.log("⚠️ 需要改进: 核心功能有问题");
		console.log("   建议: 优先修复关键功能");
	} else {
		console.log("❌ 不达标: 功能严重问题");
		console.log("   建议: 重新检查架构和实现");
	}

	// 下一步建议
	console.log("\n=== 下一步建议 ===");
	console.log("1. 在真实浏览器中测试: http://127.0.0.1:5173/");
	console.log("2. 检查文件浏览器界面是否正常渲染");
	console.log("3. 测试用户交互: 点击、选择、查看文件");
	console.log("4. 测试移动端适配和触摸交互");
	console.log("5. 运行单元测试验证组件行为");

	console.log("\n=== 模拟测试完成 ===");
}

// 运行测试
runDetailedSimulation().catch((error) => {
	console.error("测试运行错误:", error);
	process.exit(1);
});
