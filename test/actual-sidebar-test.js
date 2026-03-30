/**
 * 实际侧边栏功能测试 - 通过HTTP请求验证
 */

import { JSDOM } from "jsdom";
import fetch from "node-fetch";

async function testActualSidebarFunction() {
	console.log("=== 实际侧边栏功能测试 ===\n");
	console.log("使用运行中的服务:");
	console.log("  前端: http://127.0.0.1:5173/");
	console.log("  后端: http://127.0.0.1:3000/\n");

	const results = [];

	// 1. 获取前端页面，检查结构
	console.log("1. 获取前端页面结构...");
	try {
		const response = await fetch("http://127.0.0.1:5173/");
		const html = await response.text();
		const dom = new JSDOM(html);
		const document = dom.window.document;

		// 检查BottomMenu是否存在
		const bottomMenu = document.querySelector("nav");
		const hasBottomMenu = !!bottomMenu;
		console.log(`   BottomMenu存在: ${hasBottomMenu ? "✅" : "❌"}`);

		if (hasBottomMenu) {
			// 检查是否有侧边栏切换按钮
			const buttons = bottomMenu.querySelectorAll("button");
			const sidebarButton = Array.from(buttons).find(
				(btn) =>
					btn.title.includes("Sidebar") ||
					btn.title.includes("Hide Sidebar") ||
					btn.title.includes("Show Sidebar"),
			);

			console.log(`   侧边栏切换按钮: ${sidebarButton ? "✅" : "❌"}`);

			if (sidebarButton) {
				console.log(`   按钮标题: "${sidebarButton.title}"`);

				// 检查按钮图标（左右箭头）
				const svg = sidebarButton.querySelector("svg");
				console.log(`   有SVG图标: ${svg ? "✅" : "❌"}`);
			}
		}

		// 检查视图切换按钮
		const viewButtons = Array.from(document.querySelectorAll("button")).filter(
			(btn) =>
				btn.textContent.includes("Chat") || btn.textContent.includes("Files"),
		);
		console.log(
			`   视图切换按钮: ${viewButtons.length >= 2 ? "✅" : "❌"} (找到 ${viewButtons.length} 个)`,
		);
	} catch (error) {
		console.log(`   ❌ 错误: ${error.message}`);
		results.push(`前端页面获取失败: ${error.message}`);
	}

	// 2. 测试API端点
	console.log("\n2. 测试文件浏览API...");
	try {
		const response = await fetch("http://127.0.0.1:3000/api/browse", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path: "/" }),
		});

		if (response.ok) {
			const data = await response.json();
			console.log(`   ✅ API正常: ${data.items.length} 个项目`);

			// 检查是否有目录用于侧边栏树
			const directories = data.items.filter((item) => item.isDirectory);
			console.log(`   目录数量: ${directories.length} (侧边栏需要)`);

			if (directories.length === 0) {
				results.push("API返回的根目录中没有子目录，侧边栏树可能为空");
			}
		} else {
			console.log(`   ❌ API失败: HTTP ${response.status}`);
			results.push(`文件浏览API失败: HTTP ${response.status}`);
		}
	} catch (error) {
		console.log(`   ❌ 错误: ${error.message}`);
		results.push(`API测试错误: ${error.message}`);
	}

	// 3. 检查组件代码是否已修复
	console.log("\n3. 检查代码修复状态...");

	const checks = [
		{
			name: "App.tsx传递externalSidebarVisible",
			file: "src/client/App.tsx",
			pattern: "externalSidebarVisible={isSidebarVisible}",
		},
		{
			name: "App.tsx传递onToggleSidebar",
			file: "src/client/App.tsx",
			pattern: "onToggleSidebar={() => setIsSidebarVisible",
		},
		{
			name: "BottomMenu有侧边栏按钮",
			file: "src/client/components/layout/BottomMenu/BottomMenu.tsx",
			pattern: "onToggleSidebar",
		},
		{
			name: "FileSidebar接收visible属性",
			file: "src/client/components/files/FileSidebar.tsx",
			pattern: "visible: boolean",
		},
		{
			name: "FileBrowser接收externalSidebarVisible",
			file: "src/client/components/files/FileBrowser.tsx",
			pattern: "externalSidebarVisible",
		},
	];

	for (const check of checks) {
		try {
			const response = await fetch(`http://127.0.0.1:5173/${check.file}`);
			if (response.ok) {
				const content = await response.text();
				const hasPattern = content.includes(check.pattern);
				console.log(`   ${check.name}: ${hasPattern ? "✅" : "❌"}`);

				if (!hasPattern) {
					results.push(`${check.name} 代码修复不完整`);
				}
			} else {
				console.log(`   ${check.name}: ❌ 无法读取文件`);
				results.push(`无法检查 ${check.file}`);
			}
		} catch (error) {
			console.log(`   ${check.name}: ❌ ${error.message}`);
		}
	}

	// 4. 模拟用户操作流程
	console.log("\n4. 模拟用户操作流程（需要手动验证）:");
	console.log("   1. 访问 http://127.0.0.1:5173/");
	console.log('   2. 点击顶部"Files"按钮切换到文件视图');
	console.log("   3. 查看左下角BottomMenu中的左右箭头按钮");
	console.log("   4. 点击左右箭头按钮，应该显示/隐藏左侧文件树");
	console.log('   5. 点击顶部"Chat"按钮切换回聊天视图');
	console.log("   6. 再次点击左右箭头按钮，应该显示/隐藏聊天侧边栏");

	// 5. 总结
	console.log("\n=== 测试结果 ===");

	if (results.length === 0) {
		console.log("✅ 所有基础检查通过");
		console.log("⚠️ 需要手动验证交互功能");
	} else {
		console.log(`发现 ${results.length} 个问题:`);
		results.forEach((issue, index) => {
			console.log(`   ${index + 1}. ${issue}`);
		});
	}

	// 6. 如果发现问题，提供调试建议
	console.log("\n=== 调试建议 ===");
	console.log("如果侧边栏不工作:");
	console.log("1. 打开浏览器开发者工具 (F12)");
	console.log("2. 查看Console标签页是否有JavaScript错误");
	console.log("3. 查看Network标签页的API请求是否成功");
	console.log("4. 检查Elements标签页，查看:");
	console.log("   - FileSidebar组件是否渲染");
	console.log("   - visible属性值是否正确");
	console.log("   - CSS样式是否隐藏了组件");

	console.log("\n=== 测试完成 ===");
	return { results };
}

// 运行测试
testActualSidebarFunction().catch((error) => {
	console.error("测试运行错误:", error);
	process.exit(1);
});
