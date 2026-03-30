/**
 * 滚动问题诊断脚本
 */
const fs = require("fs");
const path = require("path");

console.log("=== 滚动问题深度诊断 ===\n");

// 1. 检查所有相关CSS
const cssFile = path.join(
	__dirname,
	"src/client/components/files/FileBrowser.module.css",
);
const cssContent = fs.readFileSync(cssFile, "utf8");

console.log("1. CSS关键属性检查:");
const checks = [
	{
		name: ".fileBrowserSection overflow",
		pattern: /\.fileBrowserSection[^{]*\{[^}]*overflow:\s*([^;\n]+)/,
	},
	{
		name: ".fileBrowserSection min-height",
		pattern: /\.fileBrowserSection[^{]*\{[^}]*min-height:\s*([^;\n]+)/,
	},
	{
		name: ".main overflow",
		pattern: /\.main[^{]*\{[^}]*overflow:\s*([^;\n]+)/,
	},
	{
		name: ".main min-height",
		pattern: /\.main[^{]*\{[^}]*min-height:\s*([^;\n]+)/,
	},
	{
		name: ".contentArea overflow-y",
		pattern: /\.contentArea[^{]*\{[^}]*overflow-y:\s*([^;\n]+)/,
	},
	{
		name: ".contentArea min-height",
		pattern: /\.contentArea[^{]*\{[^}]*min-height:\s*([^;\n]+)/,
	},
	{
		name: ".contentArea height",
		pattern: /\.contentArea[^{]*\{[^}]*height:\s*([^;\n]+)/,
	},
	{
		name: ".list overflow",
		pattern: /\.list[^{]*\{[^}]*overflow:\s*([^;\n]+)/,
	},
	{
		name: ".grid overflow",
		pattern: /\.grid[^{]*\{[^}]*overflow:\s*([^;\n]+)/,
	},
];

checks.forEach((check) => {
	const match = cssContent.match(check.pattern);
	if (match) {
		console.log(`   ✅ ${check.name}: ${match[1].trim()}`);
	} else {
		console.log(`   ❌ ${check.name}: 未找到`);
	}
});

// 2. 检查App.tsx
console.log("\n2. App.tsx容器检查:");
const appFile = path.join(__dirname, "src/client/App.tsx");
const appContent = fs.readFileSync(appFile, "utf8");

const appMatch = appContent.match(
	/currentView === 'files'[\s\S]*?<FileBrowser[\s\S]*?\/>/,
);
if (appMatch) {
	const hasOverflowHidden = appMatch[0].includes("overflow");
	const hasHeight100 = appMatch[0].includes("height: '100%'");
	console.log(`   外层div overflow设置: ${hasOverflowHidden ? "有" : "无"}`);
	console.log(`   外层div height: 100%: ${hasHeight100 ? "有" : "无"}`);
}

// 3. 检查FileBrowser结构
console.log("\n3. FileBrowser组件结构:");
const fbFile = path.join(
	__dirname,
	"src/client/components/files/FileBrowser.tsx",
);
const fbContent = fs.readFileSync(fbFile, "utf8");

const structure = [
	{
		name: "fileBrowserSection",
		pattern: /className=\{styles\.fileBrowserSection\}/,
	},
	{ name: "container", pattern: /className=\{styles\.container\}/ },
	{ name: "main", pattern: /className=\{styles\.main\}/ },
	{ name: "contentArea", pattern: /className=\{styles\.contentArea\}/ },
	{ name: "FileList/FileGrid", pattern: /FileList|FileGrid/ },
];

structure.forEach((s) => {
	const found = s.pattern.test(fbContent);
	console.log(`   ${found ? "✅" : "❌"} ${s.name}`);
});

// 4. 检查全局样式
console.log("\n4. 全局样式检查:");
const globalFiles = ["src/styles/global.css", "src/App.module.css"];

globalFiles.forEach((file) => {
	const fullPath = path.join(__dirname, file);
	if (fs.existsSync(fullPath)) {
		const content = fs.readFileSync(fullPath, "utf8");
		const hasOverflow = content.includes("overflow");
		const hasHeight =
			content.includes("height: 100") || content.includes("height:100");
		console.log(`   ${file}: overflow=${hasOverflow}, height100=${hasHeight}`);
	}
});

console.log("\n=== 诊断完成 ===");
console.log("\n建议修复:");
console.log("如果所有CSS都正确但仍不能滚动，可能是:");
console.log("1. 父容器高度没有正确设置");
console.log("2. 需要检查实际DOM计算高度");
console.log("3. 浏览器默认样式覆盖");
