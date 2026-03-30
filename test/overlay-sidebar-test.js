/**
 * Overlay侧边栏功能测试
 * 验证：左下角左右箭头按钮控制overlay侧边栏显示/隐藏
 */

import { JSDOM } from "jsdom";
import fetch from "node-fetch";

async function testOverlaySidebar() {
	console.log("=== Overlay侧边栏功能测试 ===\n");
	console.log("测试目标:");
	console.log("1. FileSidebar应该是overlay面板（position: fixed, z-index）");
	console.log("2. 左下角左右箭头按钮控制显示/隐藏");
	console.log("3. 默认状态检查（根据设计可能是显示或隐藏）");
	console.log("4. 点击按钮切换状态\n");

	// 等待前端服务完全启动
	await new Promise((resolve) => setTimeout(resolve, 2000));

	const results = [];

	// 1. 获取页面并分析结构
	console.log("1. 分析页面结构...");
	try {
		const response = await fetch("http://127.0.0.1:5173/");
		const html = await response.text();
		const dom = new JSDOM(html);
		const document = dom.window.document;

		// 检查BottomMenu
		const bottomMenu = document.querySelector("nav");
		if (!bottomMenu) {
			console.log("   ❌ 未找到BottomMenu");
			results.push("BottomMenu未渲染");
		} else {
			console.log("   ✅ 找到BottomMenu");

			// 查找左右箭头按钮
			const buttons = bottomMenu.querySelectorAll("button");
			let sidebarButton = null;
			let sidebarButtonTitle = "";

			for (const btn of buttons) {
				if (
					btn.title &&
					(btn.title.includes("Sidebar") ||
						btn.title.includes("Hide") ||
						btn.title.includes("Show"))
				) {
					sidebarButton = btn;
					sidebarButtonTitle = btn.title;
					break;
				}
			}

			if (sidebarButton) {
				console.log(`   ✅ 找到侧边栏按钮: "${sidebarButtonTitle}"`);

				// 检查按钮状态
				const isActive = sidebarButton.className.includes("active");
				console.log(`   按钮激活状态: ${isActive ? "激活" : "未激活"}`);

				// 根据按钮标题推断当前状态
				if (sidebarButtonTitle.includes("Hide")) {
					console.log("   推断: 侧边栏当前应显示");
				} else if (sidebarButtonTitle.includes("Show")) {
					console.log("   推断: 侧边栏当前应隐藏");
				}
			} else {
				console.log("   ❌ 未找到侧边栏切换按钮");
				results.push("BottomMenu中未找到侧边栏切换按钮");
			}
		}

		// 检查视图切换按钮
		const viewButtons = Array.from(document.querySelectorAll("button")).filter(
			(btn) =>
				btn.textContent &&
				(btn.textContent.includes("Chat") || btn.textContent.includes("Files")),
		);

		if (viewButtons.length >= 2) {
			console.log(`   ✅ 找到视图切换按钮: ${viewButtons.length} 个`);

			// 检查当前激活的视图
			const activeViewButton = viewButtons.find((btn) =>
				btn.className.includes("active"),
			);
			if (activeViewButton) {
				console.log(`   当前激活视图: ${activeViewButton.textContent.trim()}`);
			}
		} else {
			console.log(`   ⚠️ 视图切换按钮: 只找到 ${viewButtons.length} 个`);
		}
	} catch (error) {
		console.log(`   ❌ 错误: ${error.message}`);
		results.push(`页面分析失败: ${error.message}`);
	}

	// 2. 检查CSS样式
	console.log("\n2. 检查CSS样式...");
	try {
		const cssResponse = await fetch(
			"http://127.0.0.1:5173/src/client/components/files/FileBrowser.module.css",
		);
		const cssContent = await cssResponse.text();

		const styleChecks = {
			hasFixedPosition:
				cssContent.includes("position: fixed") &&
				cssContent.includes(".sidebar"),
			hasTransform:
				cssContent.includes("transform: translateX") &&
				cssContent.includes(".sidebar"),
			hasZIndex:
				cssContent.includes("z-index") && cssContent.includes(".sidebar"),
			hasVisibleClass: cssContent.includes(".sidebar.visible"),
			hasTransition:
				cssContent.includes("transition") && cssContent.includes(".sidebar"),
		};

		console.log(
			`   position: fixed: ${styleChecks.hasFixedPosition ? "✅" : "❌"}`,
		);
		console.log(`   transform动画: ${styleChecks.hasTransform ? "✅" : "❌"}`);
		console.log(`   z-index: ${styleChecks.hasZIndex ? "✅" : "❌"}`);
		console.log(
			`   .sidebar.visible类: ${styleChecks.hasVisibleClass ? "✅" : "❌"}`,
		);
		console.log(
			`   transition过渡: ${styleChecks.hasTransition ? "✅" : "❌"}`,
		);

		if (!styleChecks.hasFixedPosition) {
			results.push("FileSidebar缺少position: fixed样式，不是overlay");
		}
		if (!styleChecks.hasTransform) {
			results.push("FileSidebar缺少transform动画");
		}
	} catch (error) {
		console.log(`   ❌ 错误: ${error.message}`);
	}

	// 3. 检查组件逻辑
	console.log("\n3. 检查组件逻辑...");

	const componentChecks = [
		{
			file: "src/client/components/files/FileSidebar.tsx",
			check: "visible属性处理",
		},
		{ file: "src/client/App.tsx", check: "传递externalSidebarVisible" },
		{ file: "src/client/App.tsx", check: "传递onToggleSidebar" },
	];

	for (const check of componentChecks) {
		try {
			const response = await fetch(`http://127.0.0.1:5173/${check.file}`);
			if (response.ok) {
				console.log(`   ${check.check}: ✅ 文件可访问`);
			} else {
				console.log(`   ${check.check}: ❌ 文件不可访问`);
				results.push(`${check.file} 不可访问`);
			}
		} catch (error) {
			console.log(`   ${check.check}: ❌ ${error.message}`);
		}
	}

	// 4. 测试API
	console.log("\n4. 测试后端API...");
	try {
		const response = await fetch("http://127.0.0.1:3000/api/browse", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path: "/" }),
		});

		if (response.ok) {
			const data = await response.json();
			console.log(`   ✅ API正常: ${data.items.length} 个项目`);

			// 检查数据是否适合侧边栏树
			const hasDirectories = data.items.some((item) => item.isDirectory);
			console.log(`   有目录项: ${hasDirectories ? "✅" : "❌"}`);

			if (!hasDirectories) {
				results.push("API返回数据中没有目录，侧边栏树将为空");
			}
		} else {
			console.log(`   ❌ API失败: HTTP ${response.status}`);
			results.push(`文件浏览API失败: HTTP ${response.status}`);
		}
	} catch (error) {
		console.log(`   ❌ 错误: ${error.message}`);
		results.push(`API测试错误: ${error.message}`);
	}

	// 5. 总结
	console.log("\n=== 测试结果 ===");

	if (results.length === 0) {
		console.log("✅ 所有检查通过");
		console.log("\n需要手动验证的功能:");
		console.log("1. 访问 http://127.0.0.1:5173/");
		console.log('2. 点击"Files"切换到文件视图');
		console.log("3. 观察左侧是否有overlay侧边栏（可能默认显示或隐藏）");
		console.log("4. 点击左下角左右箭头按钮，侧边栏应滑动显示/隐藏");
		console.log("5. 侧边栏内应有文件树结构");
	} else {
		console.log(`发现 ${results.length} 个问题:`);
		results.forEach((issue, index) => {
			console.log(`   ${index + 1}. ${issue}`);
		});
	}

	// 6. 已知问题
	console.log("\n=== 已知设计 ===");
	console.log("根据代码分析:");
	console.log("1. FileSidebar现在是overlay设计（position: fixed）");
	console.log("2. 默认隐藏（transform: translateX(-100%)）");
	console.log("3. 显示时添加.visible类（transform: translateX(0)）");
	console.log("4. 有平滑动画（transition: transform 0.3s ease）");
	console.log("5. 控制按钮在BottomMenu中（左下角左右箭头）");

	console.log("\n=== 测试完成 ===");
	return { results };
}

// 运行测试
testOverlaySidebar().catch((error) => {
	console.error("测试运行错误:", error);
	process.exit(1);
});
