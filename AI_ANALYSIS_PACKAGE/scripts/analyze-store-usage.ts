#!/usr/bin/env tsx

/**
 * Store 使用情况分析脚本
 * 分析项目中 Store 的使用情况，发现潜在问题
 */

import { glob } from "glob";
import * as path from "path";
import * as ts from "typescript";

interface StoreUsage {
	name: string;
	file: string;
	line: number;
	type: "hook" | "selector" | "getState" | "setState";
}

interface StoreDefinition {
	name: string;
	file: string;
	line: number;
	properties: string[];
	actions: string[];
}

async function analyzeStoreUsage() {
	console.log("📊 分析 Store 使用情况...\n");

	const files = await glob("src/**/*.{ts,tsx}", {
		ignore: ["node_modules/**", "**/*.test.ts", "**/*.test.tsx"],
	});

	const program = ts.createProgram(files, {
		target: ts.ScriptTarget.ES2020,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.NodeJs,
		jsx: ts.JsxEmit.React,
	});

	const storeDefinitions: StoreDefinition[] = [];
	const storeUsages: StoreUsage[] = [];
	const crossStoreAccess: Array<{
		from: string;
		to: string;
		file: string;
		line: number;
	}> = [];

	for (const sourceFile of program.getSourceFiles()) {
		if (sourceFile.isDeclarationFile) continue;
		if (!files.includes(sourceFile.fileName)) continue;

		const relativePath = path.relative(process.cwd(), sourceFile.fileName);

		function visit(node: ts.Node) {
			// 检测 Store 定义
			if (ts.isVariableDeclaration(node) && node.name) {
				const name = node.name.getText();
				if (name.startsWith("use") && name.endsWith("Store")) {
					const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());

					// 尝试提取 store 的属性
					const properties: string[] = [];
					const actions: string[] = [];

					if (node.initializer && ts.isCallExpression(node.initializer)) {
						// 分析 create 调用的参数
						// 这里简化处理，实际可以更复杂
					}

					storeDefinitions.push({
						name,
						file: relativePath,
						line: pos.line + 1,
						properties,
						actions,
					});
				}
			}

			// 检测 Store 使用
			if (ts.isCallExpression(node)) {
				const expression = node.expression;

				// useXxxStore()
				if (ts.isIdentifier(expression)) {
					const name = expression.text;
					if (name.startsWith("use") && name.endsWith("Store")) {
						const pos = sourceFile.getLineAndCharacterOfPosition(
							node.getStart(),
						);

						// 检测使用方式
						let type: StoreUsage["type"] = "hook";
						if (node.arguments.length > 0) {
							type = "selector";
						}

						storeUsages.push({
							name,
							file: relativePath,
							line: pos.line + 1,
							type,
						});
					}
				}

				// useXxxStore.getState()
				if (ts.isPropertyAccessExpression(expression)) {
					if (expression.name.text === "getState") {
						const object = expression.expression;
						if (
							ts.isCallExpression(object) &&
							ts.isIdentifier(object.expression)
						) {
							const name = object.expression.text;
							if (name.startsWith("use") && name.endsWith("Store")) {
								const pos = sourceFile.getLineAndCharacterOfPosition(
									node.getStart(),
								);
								storeUsages.push({
									name,
									file: relativePath,
									line: pos.line + 1,
									type: "getState",
								});

								// 记录跨 store 访问
								// 这里可以进一步分析访问了哪个 store 的属性
							}
						}
					}
				}
			}

			ts.forEachChild(node, visit);
		}

		visit(sourceFile);
	}

	// 输出报告
	console.log("📦 Store 定义:\n");
	for (const def of storeDefinitions) {
		console.log(`  ${def.name}`);
		console.log(`    📄 ${def.file}:${def.line}`);
		console.log(`    📊 属性: ${def.properties.length} 个`);
		console.log(`    🔧 动作: ${def.actions.length} 个`);
		console.log();
	}

	console.log("🔍 Store 使用情况:\n");

	// 按 Store 分组
	const byStore = storeUsages.reduce(
		(acc, usage) => {
			if (!acc[usage.name]) acc[usage.name] = [];
			acc[usage.name].push(usage);
			return acc;
		},
		{} as Record<string, StoreUsage[]>,
	);

	for (const [storeName, usages] of Object.entries(byStore)) {
		console.log(`  ${storeName}:`);
		console.log(`    使用次数: ${usages.length}`);

		const byType = usages.reduce(
			(acc, u) => {
				acc[u.type] = (acc[u.type] || 0) + 1;
				return acc;
			},
			{} as Record<string, number>,
		);

		for (const [type, count] of Object.entries(byType)) {
			console.log(`      ${type}: ${count} 次`);
		}

		// 显示使用位置
		const uniqueFiles = [...new Set(usages.map((u) => u.file))];
		console.log(`    使用文件: ${uniqueFiles.length} 个`);
		console.log();
	}

	// 问题检测
	console.log("⚠️  潜在问题:\n");

	const issues: string[] = [];

	// 检测重复定义的 store
	const nameCounts = storeDefinitions.reduce(
		(acc, def) => {
			acc[def.name] = (acc[def.name] || 0) + 1;
			return acc;
		},
		{} as Record<string, number>,
	);

	for (const [name, count] of Object.entries(nameCounts)) {
		if (count > 1) {
			issues.push(`Store "${name}" 定义了 ${count} 次`);
		}
	}

	// 检测过多的 getState 使用
	const getStateUsages = storeUsages.filter((u) => u.type === "getState");
	if (getStateUsages.length > 10) {
		issues.push(
			`过多的 getState() 调用 (${getStateUsages.length} 次)，建议使用 selector`,
		);
	}

	// 检测未使用 selector 的情况
	const hookUsages = storeUsages.filter((u) => u.type === "hook");
	if (hookUsages.length > 20) {
		issues.push(
			`大量直接解构 store (${hookUsages.length} 次)，可能导致性能问题`,
		);
	}

	if (issues.length === 0) {
		console.log("  ✅ 未发现明显问题\n");
	} else {
		for (const issue of issues) {
			console.log(`  ⚠️  ${issue}`);
		}
		console.log();
	}

	// 生成建议
	console.log("💡 改进建议:\n");

	if (storeDefinitions.length > 5) {
		console.log("  1. 考虑合并 store，使用 slice 模式");
		console.log("     参考: stores/gatewayStore.ts 示例");
	}

	if (getStateUsages.length > 0) {
		console.log("  2. 减少 getState() 的使用，改用 selector");
		console.log("     好处: 更好的性能和可预测性");
	}

	if (Object.keys(byStore).length > 0) {
		const mostUsed = Object.entries(byStore).sort(
			(a, b) => b[1].length - a[1].length,
		)[0];
		console.log(
			`  3. 最常用的 store 是 "${mostUsed[0]}" (${mostUsed[1].length} 次)`,
		);
		console.log("     重点关注其设计和性能");
	}

	console.log();
}

analyzeStoreUsage().catch(console.error);
