#!/usr/bin/env tsx

/**
 * 架构验证脚本
 * 检查代码是否符合架构规范
 */

import * as fs from "fs";
import { glob } from "glob";
import * as path from "path";
import * as ts from "typescript";

// 架构规则定义
interface Rule {
	name: string;
	severity: "error" | "warning";
	message: string;
	validate: (sourceFile: ts.SourceFile) => ValidationError[];
}

interface ValidationError {
	line: number;
	column: number;
	message: string;
}

const rules: Rule[] = [
	{
		name: "no-new-stores",
		severity: "error",
		message: "禁止创建新的独立store。请使用gatewayStore的slice模式。",
		validate: (sourceFile) => {
			const errors: ValidationError[] = [];

			function visit(node: ts.Node) {
				if (ts.isCallExpression(node)) {
					const expression = node.expression;
					if (ts.isIdentifier(expression) && expression.text === "create") {
						const parent = node.parent;
						if (ts.isVariableDeclaration(parent)) {
							const name = parent.name.getText();
							if (name.startsWith("use") && name.endsWith("Store")) {
								if (name !== "useGatewayStore") {
									const pos = sourceFile.getLineAndCharacterOfPosition(
										node.getStart(),
									);
									errors.push({
										line: pos.line + 1,
										column: pos.character + 1,
										message: `违规store: ${name}`,
									});
								}
							}
						}
					}
				}
				ts.forEachChild(node, visit);
			}

			visit(sourceFile);
			return errors;
		},
	},

	{
		name: "use-unified-filters",
		severity: "error",
		message: "必须使用统一的filterMessages函数。",
		validate: (sourceFile) => {
			const errors: ValidationError[] = [];

			function visit(node: ts.Node) {
				if (ts.isFunctionDeclaration(node) && node.name) {
					const funcName = node.name.text;
					if (
						funcName.includes("filter") &&
						funcName !== "filterMessages" &&
						funcName !== "performSearch" &&
						funcName !== "getFilteredMessages"
					) {
						const pos = sourceFile.getLineAndCharacterOfPosition(
							node.getStart(),
						);
						errors.push({
							line: pos.line + 1,
							column: pos.character + 1,
							message: `违规筛选函数: ${funcName}`,
						});
					}
				}
				ts.forEachChild(node, visit);
			}

			visit(sourceFile);
			return errors;
		},
	},

	{
		name: "no-hardcoded-timeouts",
		severity: "warning",
		message: "超时值应该从config导入，而不是硬编码。",
		validate: (sourceFile) => {
			const errors: ValidationError[] = [];

			function visit(node: ts.Node) {
				if (ts.isCallExpression(node)) {
					const expression = node.expression;
					if (ts.isIdentifier(expression) && expression.text === "setTimeout") {
						if (
							node.arguments.length > 1 &&
							ts.isNumericLiteral(node.arguments[1])
						) {
							const value = node.arguments[1].text;
							// 检查是否是常见超时值
							if (["5000", "3000", "1000", "30000"].includes(value)) {
								const pos = sourceFile.getLineAndCharacterOfPosition(
									node.getStart(),
								);
								errors.push({
									line: pos.line + 1,
									column: pos.character + 1,
									message: `硬编码超时: ${value}ms`,
								});
							}
						}
					}
				}
				ts.forEachChild(node, visit);
			}

			visit(sourceFile);
			return errors;
		},
	},

	{
		name: "no-hardcoded-urls",
		severity: "warning",
		message: "URL应该从配置导入，而不是硬编码。",
		validate: (sourceFile) => {
			const errors: ValidationError[] = [];
			const urlPattern = /(localhost|127\.0\.0\.1):\d+|ws:\/\/|http:\/\//;

			function visit(node: ts.Node) {
				if (ts.isStringLiteral(node)) {
					const text = node.text;
					if (urlPattern.test(text)) {
						const pos = sourceFile.getLineAndCharacterOfPosition(
							node.getStart(),
						);
						errors.push({
							line: pos.line + 1,
							column: pos.character + 1,
							message: `硬编码URL: ${text.substring(0, 30)}...`,
						});
					}
				}
				ts.forEachChild(node, visit);
			}

			visit(sourceFile);
			return errors;
		},
	},

	{
		name: "no-direct-store-access",
		severity: "warning",
		message: "避免直接调用其他store的getState()，应该使用slice组合。",
		validate: (sourceFile) => {
			const errors: ValidationError[] = [];

			function visit(node: ts.Node) {
				if (ts.isCallExpression(node)) {
					const expression = node.expression;
					if (ts.isPropertyAccessExpression(expression)) {
						if (expression.name.text === "getState") {
							const object = expression.expression;
							if (
								ts.isCallExpression(object) &&
								ts.isIdentifier(object.expression) &&
								object.expression.text.startsWith("use") &&
								object.expression.text.endsWith("Store")
							) {
								const pos = sourceFile.getLineAndCharacterOfPosition(
									node.getStart(),
								);
								errors.push({
									line: pos.line + 1,
									column: pos.character + 1,
									message: `直接store访问: ${object.expression.text}`,
								});
							}
						}
					}
				}
				ts.forEachChild(node, visit);
			}

			visit(sourceFile);
			return errors;
		},
	},
];

// 主函数
async function validateArchitecture() {
	console.log("🔍 开始架构验证...\n");

	// 读取所有 TypeScript 文件
	const files = await glob("src/**/*.{ts,tsx}", {
		ignore: ["node_modules/**", "**/*.test.ts", "**/*.test.tsx", "**/*.d.ts"],
	});

	const program = ts.createProgram(files, {
		target: ts.ScriptTarget.ES2020,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.NodeJs,
		jsx: ts.JsxEmit.React,
	});

	const allErrors: Array<{
		file: string;
		rule: string;
		severity: string;
		line: number;
		column: number;
		message: string;
	}> = [];

	// 验证每个文件
	for (const sourceFile of program.getSourceFiles()) {
		if (sourceFile.isDeclarationFile) continue;
		if (!files.includes(sourceFile.fileName)) continue;

		for (const rule of rules) {
			const errors = rule.validate(sourceFile);
			for (const error of errors) {
				allErrors.push({
					file: path.relative(process.cwd(), sourceFile.fileName),
					rule: rule.name,
					severity: rule.severity,
					line: error.line,
					column: error.column,
					message: `${rule.message} (${error.message})`,
				});
			}
		}
	}

	// 输出结果
	const errors = allErrors.filter((e) => e.severity === "error");
	const warnings = allErrors.filter((e) => e.severity === "warning");

	if (allErrors.length === 0) {
		console.log("✅ 架构验证通过！没有发现问题。\n");
		return 0;
	}

	// 按文件分组
	const byFile = allErrors.reduce(
		(acc, error) => {
			if (!acc[error.file]) acc[error.file] = [];
			acc[error.file].push(error);
			return acc;
		},
		{} as Record<string, typeof allErrors>,
	);

	console.log("📋 验证结果:\n");

	for (const [file, fileErrors] of Object.entries(byFile)) {
		console.log(`\n📄 ${file}`);
		for (const error of fileErrors) {
			const icon = error.severity === "error" ? "❌" : "⚠️";
			console.log(
				`  ${icon} Line ${error.line}:${error.column} [${error.rule}]`,
			);
			console.log(`     ${error.message}`);
		}
	}

	console.log(`\n📊 统计:`);
	console.log(`   错误: ${errors.length}`);
	console.log(`   警告: ${warnings.length}`);
	console.log(`   总计: ${allErrors.length}`);

	if (errors.length > 0) {
		console.log(`\n❌ 验证失败！请修复 ${errors.length} 个错误。\n`);
		return 1;
	} else {
		console.log(`\n⚠️  验证通过，但有 ${warnings.length} 个警告。\n`);
		return 0;
	}
}

// 运行验证
validateArchitecture().then((code) => process.exit(code));
