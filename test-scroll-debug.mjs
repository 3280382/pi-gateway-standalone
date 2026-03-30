import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const appSection = appContent.match(
	/currentView === 'files'[\s\S]*?<FileBrowser[\s\S]*?\/>/,
);
if (appSection) {
	console.log("   找到FileBrowser渲染代码");
	console.log("   内容片段:", appSection[0].substring(0, 200));
}

console.log("\n=== 诊断完成 ===");
