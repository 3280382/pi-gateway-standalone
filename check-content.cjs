const fs = require("fs");

console.log("=== 检查文件列表渲染逻辑 ===\n");

// 1. 检查FileBrowser的渲染逻辑
const fbContent = fs.readFileSync(
	"src/client/components/files/FileBrowser.tsx",
	"utf8",
);

console.log("1. FileBrowser渲染检查:");
const hasContentArea = fbContent.includes("contentArea");
const hasFileList =
	fbContent.includes("FileList") || fbContent.includes("FileGrid");
const hasItemsMap =
	fbContent.includes("filteredItems.map") || fbContent.includes("items.map");
const hasLoadingCheck = fbContent.includes("isLoading");
const hasEmptyCheck = fbContent.includes("filteredItems.length === 0");

console.log("   contentArea:", hasContentArea ? "✅" : "❌");
console.log("   FileList/FileGrid:", hasFileList ? "✅" : "❌");
console.log("   items.map:", hasItemsMap ? "✅" : "❌");
console.log("   loading检查:", hasLoadingCheck ? "✅" : "❌");
console.log("   empty检查:", hasEmptyCheck ? "✅" : "❌");

// 2. 检查FileList
console.log("\n2. FileList组件检查:");
const flContent = fs.readFileSync(
	"src/client/components/files/FileList.tsx",
	"utf8",
);
const hasMap = flContent.includes("items.map");
const hasKey = flContent.includes("key={");
const hasClassName = flContent.includes("className={");

console.log("   items.map:", hasMap ? "✅" : "❌");
console.log("   key属性:", hasKey ? "✅" : "❌");
console.log("   className:", hasClassName ? "✅" : "❌");

// 3. 检查CSS中的list样式
console.log("\n3. CSS list样式检查:");
const cssContent = fs.readFileSync(
	"src/client/components/files/FileBrowser.module.css",
	"utf8",
);

const listMatch = cssContent.match(/\.list\s*{([^}]+)}/);
const gridMatch = cssContent.match(/\.grid\s*{([^}]+)}/);

if (listMatch) {
	console.log("   .list 样式:", listMatch[1].trim().replace(/\n/g, " "));
} else {
	console.log("   .list: ❌ 未找到");
}

if (gridMatch) {
	console.log("   .grid 样式:", gridMatch[1].trim().replace(/\n/g, " "));
} else {
	console.log("   .grid: ❌ 未找到");
}

// 4. 检查实际渲染的部分
console.log("\n4. FileBrowser渲染逻辑:");
const renderSection = fbContent.match(
	/return \([\s\S]*?<section[\s\S]*?<\/section>/,
);
if (renderSection) {
	console.log("   找到render代码");
	console.log("   长度:", renderSection[0].length, "字符");
}

console.log("\n=== 检查完成 ===");
