/**
 * 简单的端到端测试脚本
 * 验证文件浏览器基本功能是否工作
 */

const http = require("http");

// 测试前端服务
console.log("测试前端服务...");
http
	.get("http://127.0.0.1:5173", (res) => {
		console.log(`前端HTTP状态码: ${res.statusCode}`);
		if (res.statusCode === 200) {
			console.log("✅ 前端服务正常");
		} else {
			console.log("❌ 前端服务异常");
		}
	})
	.on("error", (err) => {
		console.log("❌ 前端服务错误:", err.message);
	});

// 测试后端API
console.log("\n测试后端API...");
const apiTest = http.request(
	{
		hostname: "127.0.0.1",
		port: 3000,
		path: "/api/version",
		method: "GET",
		timeout: 5000,
	},
	(res) => {
		console.log(`后端API状态码: ${res.statusCode}`);
		let data = "";
		res.on("data", (chunk) => (data += chunk));
		res.on("end", () => {
			try {
				const json = JSON.parse(data);
				console.log("✅ 后端API正常:", json);
			} catch (e) {
				console.log("✅ 后端API响应:", data.substring(0, 100));
			}
		});
	},
);

apiTest.on("error", (err) => {
	console.log("❌ 后端API错误:", err.message);
});
apiTest.end();

// 测试文件浏览API
console.log("\n测试文件浏览API...");
const browseTest = http.request(
	{
		hostname: "127.0.0.1",
		port: 3000,
		path: "/api/browse",
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		timeout: 10000,
	},
	(res) => {
		console.log(`文件浏览API状态码: ${res.statusCode}`);
		let data = "";
		res.on("data", (chunk) => (data += chunk));
		res.on("end", () => {
			if (res.statusCode === 200) {
				try {
					const json = JSON.parse(data);
					console.log("✅ 文件浏览API正常");
					console.log(`   当前路径: ${json.currentPath}`);
					console.log(`   文件数量: ${json.items ? json.items.length : 0}`);

					// 显示前几个文件
					if (json.items && json.items.length > 0) {
						console.log("   示例文件:");
						json.items.slice(0, 3).forEach((item) => {
							console.log(
								`     - ${item.name} (${item.isDirectory ? "目录" : "文件"})`,
							);
						});
					}
				} catch (e) {
					console.log("❌ 文件浏览API响应解析错误:", e.message);
					console.log("响应内容:", data.substring(0, 200));
				}
			} else {
				console.log("❌ 文件浏览API失败");
				console.log("响应内容:", data.substring(0, 200));
			}
		});
	},
);

browseTest.on("error", (err) => {
	console.log("❌ 文件浏览API错误:", err.message);
});

// 发送请求体
browseTest.write(JSON.stringify({ path: "/root" }));
browseTest.end();

// 测试文件读取API
console.log("\n测试文件读取API...");
// 先找一个存在的文件
const testFile = "/root/pi-gateway-standalone/package.json";
const readTest = http.request(
	{
		hostname: "127.0.0.1",
		port: 3000,
		path: `/api/files/content?path=${encodeURIComponent(testFile)}`,
		method: "GET",
		timeout: 10000,
	},
	(res) => {
		console.log(`文件读取API状态码: ${res.statusCode}`);
		let data = "";
		res.on("data", (chunk) => (data += chunk));
		res.on("end", () => {
			if (res.statusCode === 200) {
				console.log("✅ 文件读取API正常");
				console.log(`   文件大小: ${data.length} 字节`);
				// 显示文件开头部分
				const preview = data.substring(0, 100).replace(/\n/g, " ");
				console.log(`   文件预览: ${preview}...`);
			} else {
				console.log("❌ 文件读取API失败");
				console.log("响应内容:", data.substring(0, 200));
			}
		});
	},
);

readTest.on("error", (err) => {
	console.log("❌ 文件读取API错误:", err.message);
});
readTest.end();

console.log("\n=== 测试完成 ===");
