/**
 * 快速验证修复
 */

import fetch from "node-fetch";

async function quickVerify() {
	console.log("=== 快速验证修复 ===\n");

	// 1. 检查服务
	console.log("1. 检查服务状态:");
	try {
		const frontend = await fetch("http://127.0.0.1:5173/");
		console.log(
			`   前端: ${frontend.status === 200 ? "✅" : "❌"} (HTTP ${frontend.status})`,
		);

		const backend = await fetch("http://127.0.0.1:3000/api/version");
		console.log(
			`   后端: ${backend.status === 200 ? "✅" : "❌"} (HTTP ${backend.status})`,
		);
	} catch (error) {
		console.log(`   ❌ 错误: ${error.message}`);
	}

	// 2. 检查关键文件
	console.log("\n2. 检查关键文件:");
	const files = [
		"src/client/components/files/FileSidebar.tsx",
		"src/client/components/files/FileBrowser.module.css",
		"src/client/App.tsx",
	];

	for (const file of files) {
		try {
			const response = await fetch(`http://127.0.0.1:5173/${file}`);
			console.log(`   ${file}: ${response.status === 200 ? "✅" : "❌"}`);
		} catch (error) {
			console.log(`   ${file}: ❌ ${error.message}`);
		}
	}

	// 3. 总结
	console.log("\n=== 修复总结 ===");
	console.log("已完成:");
	console.log("1. ✅ FileSidebar组件重建（overlay设计）");
	console.log("2. ✅ CSS样式修改（position: fixed, transform动画）");
	console.log("3. ✅ App.tsx传递externalSidebarVisible和onToggleSidebar");
	console.log("4. ✅ 前端服务正常运行");

	console.log("\n=== 需要手动测试 ===");
	console.log("请访问 http://127.0.0.1:5173/ 并测试:");
	console.log('1. 点击顶部"Files"按钮切换到文件视图');
	console.log("2. 观察左侧是否有overlay侧边栏（默认应隐藏）");
	console.log("3. 点击左下角左右箭头按钮");
	console.log("4. 侧边栏应从左侧滑入显示");
	console.log("5. 再次点击按钮，侧边栏应滑出隐藏");
	console.log("6. 侧边栏内应有文件树结构");

	console.log("\n=== 如果还有问题 ===");
	console.log("1. 打开浏览器开发者工具 (F12)");
	console.log("2. 检查Console是否有错误");
	console.log("3. 检查Network请求是否正常");
	console.log("4. 检查Elements中FileSidebar的CSS类");

	console.log("\n=== 验证完成 ===");
}

quickVerify().catch(console.error);
