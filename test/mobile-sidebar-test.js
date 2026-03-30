/**
 * 移动端侧边栏显示测试
 * 模拟移动端环境，检查FileSidebar是否可访问
 */

import fetch from "node-fetch";

// 移动端User-Agent
const MOBILE_USER_AGENTS = [
	"Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36",
	"Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
	"Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36",
];

async function testMobileSidebar() {
	console.log("=== 移动端侧边栏显示测试 ===\n");

	const results = [];

	// 1. 测试不同移动设备的页面加载
	console.log("1. 测试不同移动设备访问...");
	for (const ua of MOBILE_USER_AGENTS) {
		try {
			const response = await fetch("http://127.0.0.1:5173/", {
				headers: { "User-Agent": ua },
			});

			const deviceName = ua.includes("iPhone")
				? "iPhone"
				: ua.includes("Android")
					? "Android"
					: "Mobile";

			if (response.ok) {
				const html = await response.text();

				// 检查关键元素
				const checks = {
					hasToggleButton:
						html.includes("Toggle sidebar") || html.includes("toggle-sidebar"),
					hasSidebarElement:
						html.includes("sidebar") || html.includes("file-sidebar"),
					hasFileBrowser:
						html.includes("FileBrowser") || html.includes("file-browser"),
					hasToolbar: html.includes("toolbar") || html.includes("FileToolbar"),
				};

				console.log(`   ${deviceName}: ✅ 页面加载成功`);
				console.log(`     切换按钮: ${checks.hasToggleButton ? "✅" : "❌"}`);
				console.log(
					`     侧边栏元素: ${checks.hasSidebarElement ? "✅" : "❌"}`,
				);
				console.log(`     文件浏览器: ${checks.hasFileBrowser ? "✅" : "❌"}`);
				console.log(`     工具栏: ${checks.hasToolbar ? "✅" : "❌"}`);

				if (!checks.hasToggleButton) {
					results.push(`${deviceName}: 未找到侧边栏切换按钮`);
				}
				if (!checks.hasSidebarElement) {
					results.push(`${deviceName}: 未找到侧边栏元素`);
				}
			} else {
				console.log(`   ${deviceName}: ❌ HTTP ${response.status}`);
				results.push(`${deviceName}: 页面加载失败`);
			}
		} catch (error) {
			console.log(`   ${deviceName}: ❌ ${error.message}`);
			results.push(`${deviceName}: 访问错误`);
		}
	}

	// 2. 测试API响应（移动端应该也能访问）
	console.log("\n2. 测试移动端API访问...");
	try {
		const response = await fetch("http://127.0.0.1:3000/api/browse", {
			method: "POST",
			headers: {
				"User-Agent": MOBILE_USER_AGENTS[0],
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ path: "/" }),
		});

		if (response.ok) {
			const data = await response.json();
			console.log(`   ✅ API访问成功: ${data.items.length} 个项目`);

			// 检查是否有足够的目录来显示树结构
			const directories = data.items.filter((item) => item.isDirectory);
			console.log(`     目录数量: ${directories.length} (树结构需要至少1个)`);

			if (directories.length === 0) {
				results.push("API返回的根目录中没有子目录，无法显示树结构");
			}
		} else {
			console.log(`   ❌ API访问失败: HTTP ${response.status}`);
			results.push(`移动端API访问失败: HTTP ${response.status}`);
		}
	} catch (error) {
		console.log(`   ❌ API错误: ${error.message}`);
		results.push(`API访问错误: ${error.message}`);
	}

	// 3. 检查CSS响应式设计
	console.log("\n3. 分析可能的CSS问题...");
	console.log("   常见移动端侧边栏问题:");
	console.log("   a) 默认隐藏: 侧边栏在移动端默认隐藏，需要按钮切换");
	console.log("   b) 按钮太小: 切换按钮在移动端太小，难以点击");
	console.log("   c) 位置不对: 侧边栏可能覆盖主要内容");
	console.log("   d) 触摸目标: 树节点太小，难以触摸");

	// 4. 检查FileSidebar组件逻辑
	console.log("\n4. 检查组件逻辑...");
	try {
		const fsResponse = await fetch(
			"http://127.0.0.1:5173/src/client/components/files/FileSidebar.tsx",
		);
		const fsCode = await fsResponse.text();

		const checks = {
			hasVisibleProp: fsCode.includes("visible: boolean"),
			hasConditionalRender:
				fsCode.includes("if (!visible)") || fsCode.includes("visible &&"),
			hasMobileStyles:
				fsCode.includes("@media") || fsCode.includes("max-width"),
			hasTouchHandling: fsCode.includes("onTouch") || fsCode.includes("touch"),
		};

		console.log(`   有visible属性: ${checks.hasVisibleProp ? "✅" : "❌"}`);
		console.log(`   有条件渲染: ${checks.hasConditionalRender ? "✅" : "❌"}`);
		console.log(`   有移动端样式: ${checks.hasMobileStyles ? "✅" : "❌"}`);
		console.log(`   有触摸处理: ${checks.hasTouchHandling ? "✅" : "❌"}`);

		if (!checks.hasVisibleProp) {
			results.push("FileSidebar组件没有visible属性控制显示/隐藏");
		}
		if (!checks.hasMobileStyles) {
			results.push("FileSidebar组件可能缺少移动端响应式样式");
		}
	} catch (error) {
		console.log(`   ❌ 组件检查错误: ${error.message}`);
	}

	// 5. 总结和建议
	console.log("\n=== 测试结果总结 ===");

	if (results.length === 0) {
		console.log("✅ 未发现明显问题");
		console.log("可能的原因:");
		console.log("   1. 侧边栏默认隐藏，需要点击工具栏按钮显示");
		console.log("   2. 在移动端，工具栏按钮可能被隐藏或难以发现");
		console.log('   3. 需要切换到"files"视图才能看到文件浏览器');
	} else {
		console.log(`发现 ${results.length} 个问题:`);
		results.forEach((issue, index) => {
			console.log(`   ${index + 1}. ${issue}`);
		});
	}

	// 6. 用户操作指南
	console.log("\n=== 移动端使用指南 ===");
	console.log("如果侧边栏不显示，请尝试:");
	console.log('1. 确保在"files"视图 (点击Chat/Files切换按钮)');
	console.log("2. 查找工具栏上的侧边栏切换按钮 (可能显示为 ≡ 或 📁 图标)");
	console.log("3. 点击切换按钮显示/隐藏侧边栏");
	console.log("4. 如果按钮太小，尝试双指缩放页面");
	console.log("5. 检查是否有JavaScript错误 (F12 → Console)");

	// 7. 开发者调试建议
	console.log("\n=== 开发者调试建议 ===");
	console.log("1. 修改默认显示: 将fileStore.ts中的sidebarVisible改为true");
	console.log('2. 增加移动端提示: 在移动端显示"点击这里显示侧边栏"提示');
	console.log("3. 优化触摸目标: 确保树节点和按钮有足够大的触摸区域");
	console.log("4. 添加手势支持: 支持滑动手势显示/隐藏侧边栏");

	console.log("\n=== 测试完成 ===");
	return { results };
}

// 运行测试
testMobileSidebar().catch((error) => {
	console.error("测试运行错误:", error);
	process.exit(1);
});
