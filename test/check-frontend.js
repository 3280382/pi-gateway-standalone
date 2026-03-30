/**
 * 检查前端应用是否正常工作
 */

import fetch from "node-fetch";

async function checkFrontend() {
	console.log("检查前端应用...\n");

	// 1. 检查HTML页面
	console.log("1. 获取HTML页面...");
	try {
		const htmlResponse = await fetch("http://127.0.0.1:5173/");
		console.log(
			`   HTTP状态: ${htmlResponse.status} ${htmlResponse.statusText}`,
		);

		const html = await htmlResponse.text();
		const hasReactRoot = html.includes('id="root"');
		const hasScripts = html.includes('<script type="module"');

		console.log(`   有React根元素: ${hasReactRoot ? "✅" : "❌"}`);
		console.log(`   有JavaScript脚本: ${hasScripts ? "✅" : "❌"}`);

		// 检查是否包含文件浏览器相关的内容
		const hasFileBrowser = html.includes("file") || html.includes("File");
		console.log(`   可能包含文件浏览器: ${hasFileBrowser ? "✅" : "❌"}`);
	} catch (error) {
		console.log(`   ❌ 错误: ${error.message}`);
	}

	// 2. 检查JavaScript资源
	console.log("\n2. 检查JavaScript资源...");
	try {
		const jsResponse = await fetch("http://127.0.0.1:5173/src/client/main.tsx");
		console.log(
			`   主入口文件: ${jsResponse.status === 200 ? "✅ 可访问" : "❌ 不可访问"}`,
		);
	} catch (error) {
		console.log(`   ❌ 错误: ${error.message}`);
	}

	// 3. 模拟API调用（前端应该会调用这些API）
	console.log("\n3. 模拟前端API调用...");

	const apiEndpoints = [
		{
			name: "获取设置",
			url: "http://127.0.0.1:3000/api/settings",
			method: "GET",
		},
		{
			name: "获取工作区",
			url: "http://127.0.0.1:3000/api/workspace/current",
			method: "GET",
		},
		{
			name: "浏览目录",
			url: "http://127.0.0.1:3000/api/browse",
			method: "POST",
			body: { path: "/root" },
		},
	];

	for (const endpoint of apiEndpoints) {
		try {
			const options = {
				method: endpoint.method,
				headers: { "Content-Type": "application/json" },
			};

			if (endpoint.body) {
				options.body = JSON.stringify(endpoint.body);
			}

			const response = await fetch(endpoint.url, options);
			console.log(
				`   ${endpoint.name}: ${response.status === 200 ? "✅" : "❌"} (HTTP ${response.status})`,
			);
		} catch (error) {
			console.log(`   ${endpoint.name}: ❌ 错误: ${error.message}`);
		}
	}

	// 4. 检查WebSocket连接
	console.log("\n4. 检查WebSocket支持...");
	console.log("   WebSocket端点: ws://127.0.0.1:3000");
	console.log("   ⚠️ 需要浏览器环境测试WebSocket");

	// 5. 建议
	console.log("\n5. 建议:");
	console.log("   • 在浏览器中打开 http://127.0.0.1:5173/");
	console.log("   • 打开开发者工具 (F12)");
	console.log("   • 查看控制台日志和网络请求");
	console.log("   • 检查是否有JavaScript错误");
	console.log("   • 查看文件浏览器是否正常加载");

	console.log("\n=== 检查完成 ===");
}

// 运行检查
checkFrontend().catch(console.error);
