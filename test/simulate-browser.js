/**
 * 模拟浏览器测试
 * 使用Node.js模拟浏览器行为，验证文件浏览器功能
 */

import { JSDOM } from "jsdom";
import fetch from "node-fetch";

// 模拟移动浏览器User-Agent
const MOBILE_USER_AGENT =
	"Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36";
const DESKTOP_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function simulateBrowserTest() {
	console.log("=== 模拟浏览器测试开始 ===\n");

	const results = {
		desktop: { success: false, errors: [] },
		mobile: { success: false, errors: [] },
		api: { success: false, errors: [] },
		overall: { success: false },
	};

	// 1. 测试桌面浏览器访问
	console.log("1. 测试桌面浏览器访问...");
	try {
		const response = await fetch("http://127.0.0.1:5173/", {
			headers: { "User-Agent": DESKTOP_USER_AGENT },
		});

		if (response.ok) {
			const html = await response.text();
			const dom = new JSDOM(html);
			const document = dom.window.document;

			// 检查基本结构
			const hasRoot = !!document.getElementById("root");
			const hasScripts =
				document.querySelectorAll('script[type="module"]').length > 0;
			const hasStyles =
				document.querySelectorAll('link[rel="stylesheet"]').length > 0;

			console.log(`   ✅ 页面加载成功 (HTTP ${response.status})`);
			console.log(`     有React根元素: ${hasRoot ? "✅" : "❌"}`);
			console.log(`     有JavaScript模块: ${hasScripts ? "✅" : "❌"}`);
			console.log(`     有样式表: ${hasStyles ? "✅" : "❌"}`);

			// 检查错误显示
			const errorDivs = document.querySelectorAll(
				'div[style*="color:red"], div[style*="color: red"]',
			);
			if (errorDivs.length > 0) {
				const error = `发现 ${errorDivs.length} 个错误显示元素`;
				results.desktop.errors.push(error);
				console.log(`   ⚠️ ${error}`);
			}

			results.desktop.success = hasRoot && hasScripts;
		} else {
			const error = `HTTP ${response.status}: ${response.statusText}`;
			results.desktop.errors.push(error);
			console.log(`   ❌ ${error}`);
		}
	} catch (error) {
		results.desktop.errors.push(error.message);
		console.log(`   ❌ 错误: ${error.message}`);
	}

	// 2. 测试移动浏览器访问
	console.log("\n2. 测试移动浏览器访问...");
	try {
		const response = await fetch("http://127.0.0.1:5173/", {
			headers: { "User-Agent": MOBILE_USER_AGENT },
		});

		if (response.ok) {
			console.log(`   ✅ 移动端页面加载成功 (HTTP ${response.status})`);

			// 检查响应头中的移动端相关标记
			const contentType = response.headers.get("content-type") || "";
			const cacheControl = response.headers.get("cache-control") || "";

			console.log(`     内容类型: ${contentType}`);
			console.log(`     缓存控制: ${cacheControl}`);

			results.mobile.success = true;
		} else {
			const error = `HTTP ${response.status}: ${response.statusText}`;
			results.mobile.errors.push(error);
			console.log(`   ❌ ${error}`);
		}
	} catch (error) {
		results.mobile.errors.push(error.message);
		console.log(`   ❌ 错误: ${error.message}`);
	}

	// 3. 测试API端点
	console.log("\n3. 测试API端点...");
	const apiTests = [
		{
			name: "版本API",
			url: "http://127.0.0.1:3000/api/version",
			method: "GET",
		},
		{
			name: "设置API",
			url: "http://127.0.0.1:3000/api/settings",
			method: "GET",
		},
		{
			name: "工作区API",
			url: "http://127.0.0.1:3000/api/workspace/current",
			method: "GET",
		},
		{
			name: "文件浏览API",
			url: "http://127.0.0.1:3000/api/browse",
			method: "POST",
			body: { path: "/root" },
		},
		{
			name: "文件内容API",
			url: "http://127.0.0.1:3000/api/files/content?path=/root/pi-gateway-standalone/package.json",
			method: "GET",
		},
	];

	let apiSuccessCount = 0;

	for (const test of apiTests) {
		try {
			const options = {
				method: test.method,
				headers: {
					"User-Agent": DESKTOP_USER_AGENT,
					"Content-Type": "application/json",
				},
			};

			if (test.body) {
				options.body = JSON.stringify(test.body);
			}

			const response = await fetch(test.url, options);

			if (response.ok) {
				apiSuccessCount++;
				console.log(`   ✅ ${test.name}: 成功 (HTTP ${response.status})`);
			} else {
				const error = `${test.name}: HTTP ${response.status}`;
				results.api.errors.push(error);
				console.log(`   ❌ ${error}`);
			}
		} catch (error) {
			results.api.errors.push(`${test.name}: ${error.message}`);
			console.log(`   ❌ ${test.name}: ${error.message}`);
		}
	}

	results.api.success = apiSuccessCount === apiTests.length;
	console.log(`   API测试: ${apiSuccessCount}/${apiTests.length} 通过`);

	// 4. 模拟文件浏览器工作流
	console.log("\n4. 模拟文件浏览器工作流...");
	try {
		// 浏览根目录
		const browseResponse = await fetch("http://127.0.0.1:3000/api/browse", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path: "/root" }),
		});

		if (browseResponse.ok) {
			const browseData = await browseResponse.json();
			console.log(`   ✅ 浏览根目录成功`);
			console.log(`     当前路径: ${browseData.currentPath}`);
			console.log(`     找到 ${browseData.items.length} 个项目`);

			// 检查数据结构
			const validItems = browseData.items.filter(
				(item) =>
					item.name && item.path && typeof item.isDirectory === "boolean",
			);

			if (validItems.length === browseData.items.length) {
				console.log(`     ✅ 所有项目数据结构正确`);
			} else {
				console.log(
					`     ⚠️ ${browseData.items.length - validItems.length} 个项目数据结构有问题`,
				);
			}

			// 尝试找到一个文件来测试读取
			const firstFile = browseData.items.find(
				(item) => !item.isDirectory && item.name.endsWith(".json"),
			);
			if (firstFile) {
				console.log(`     找到测试文件: ${firstFile.name}`);

				const readResponse = await fetch(
					`http://127.0.0.1:3000/api/files/content?path=${encodeURIComponent(firstFile.path)}`,
				);
				if (readResponse.ok) {
					const fileData = await readResponse.json();
					console.log(`     ✅ 文件读取成功: ${fileData.content.length} 字符`);
				} else {
					console.log(`     ⚠️ 文件读取失败: HTTP ${readResponse.status}`);
				}
			} else {
				console.log(`     ℹ️ 未找到合适的测试文件`);
			}
		} else {
			console.log(`   ❌ 浏览根目录失败: HTTP ${browseResponse.status}`);
		}
	} catch (error) {
		console.log(`   ❌ 工作流测试错误: ${error.message}`);
	}

	// 5. 总结
	console.log("\n=== 测试结果总结 ===");

	const allTests = [
		{ name: "桌面浏览器", result: results.desktop },
		{ name: "移动浏览器", result: results.mobile },
		{ name: "API端点", result: results.api },
	];

	let totalSuccess = 0;
	const totalTests = allTests.length;

	for (const test of allTests) {
		const status = test.result.success ? "✅" : "❌";
		console.log(
			`${status} ${test.name}: ${test.result.success ? "通过" : "失败"}`,
		);

		if (test.result.success) totalSuccess++;

		if (test.result.errors.length > 0) {
			console.log(`   错误:`);
			test.result.errors.forEach((error) => console.log(`     - ${error}`));
		}
	}

	results.overall.success = totalSuccess === totalTests;

	console.log(`\n总体: ${totalSuccess}/${totalTests} 通过`);
	console.log(
		`状态: ${results.overall.success ? "✅ 所有测试通过" : "❌ 有测试失败"}`,
	);

	// 6. 建议
	console.log("\n=== 建议 ===");
	if (!results.overall.success) {
		console.log("需要修复的问题:");
		if (!results.desktop.success) console.log("  • 修复桌面浏览器访问问题");
		if (!results.mobile.success) console.log("  • 修复移动浏览器访问问题");
		if (!results.api.success) console.log("  • 修复API端点问题");
	} else {
		console.log("所有基础测试通过！下一步:");
		console.log("  • 在真实浏览器中测试 http://127.0.0.1:5173/");
		console.log("  • 检查文件浏览器界面是否正常显示");
		console.log("  • 测试文件浏览、选择、查看功能");
		console.log("  • 测试移动端触摸交互");
	}

	console.log("\n=== 测试完成 ===");
	return results;
}

// 运行测试
simulateBrowserTest().catch((error) => {
	console.error("测试运行错误:", error);
	process.exit(1);
});
