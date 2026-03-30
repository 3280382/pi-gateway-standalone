/**
 * SlashCommands Unit Tests
 * 测试命令定义和分类
 */

import { describe, expect, it } from "vitest";
import { createSlashCommands, SLASH_COMMANDS } from "./slashCommands";

describe("SlashCommands", () => {
	describe("Command Definitions", () => {
		it("should have 27 commands", () => {
			expect(SLASH_COMMANDS).toHaveLength(27);
		});

		it("should have unique command names", () => {
			const names = SLASH_COMMANDS.map((cmd) => cmd.name);
			const uniqueNames = new Set(names);
			expect(uniqueNames.size).toBe(names.length);
		});

		it("should have required fields for all commands", () => {
			SLASH_COMMANDS.forEach((cmd) => {
				expect(cmd.name).toBeDefined();
				expect(cmd.name.startsWith("/")).toBe(true);
				expect(cmd.description).toBeDefined();
				expect(cmd.description.length).toBeGreaterThan(0);
				expect(cmd.category).toBeDefined();
				expect(cmd.icon).toBeDefined();
			});
		});
	});

	describe("Command Categories", () => {
		it("should have session commands", () => {
			const sessionCmds = SLASH_COMMANDS.filter(
				(cmd) => cmd.category === "session",
			);
			expect(sessionCmds.length).toBeGreaterThan(0);

			const names = sessionCmds.map((cmd) => cmd.name);
			expect(names).toContain("/new");
			expect(names).toContain("/clear");
			expect(names).toContain("/save");
			expect(names).toContain("/load");
		});

		it("should have context commands", () => {
			const contextCmds = SLASH_COMMANDS.filter(
				(cmd) => cmd.category === "context",
			);
			expect(contextCmds.length).toBeGreaterThan(0);

			const names = contextCmds.map((cmd) => cmd.name);
			expect(names).toContain("/context");
			expect(names).toContain("/agents");
			expect(names).toContain("/model");
		});

		it("should have tools commands", () => {
			const toolsCmds = SLASH_COMMANDS.filter(
				(cmd) => cmd.category === "tools",
			);
			expect(toolsCmds.length).toBeGreaterThan(0);

			const names = toolsCmds.map((cmd) => cmd.name);
			expect(names).toContain("/bash");
			expect(names).toContain("/read");
			expect(names).toContain("/write");
		});

		it("should have help commands", () => {
			const helpCmds = SLASH_COMMANDS.filter((cmd) => cmd.category === "help");
			expect(helpCmds.length).toBeGreaterThan(0);

			const names = helpCmds.map((cmd) => cmd.name);
			expect(names).toContain("/help");
			expect(names).toContain("/theme");
		});
	});

	describe("Command Names", () => {
		it("should start with /", () => {
			SLASH_COMMANDS.forEach((cmd) => {
				expect(cmd.name.startsWith("/")).toBe(true);
			});
		});

		it("should have lowercase names", () => {
			SLASH_COMMANDS.forEach((cmd) => {
				expect(cmd.name).toBe(cmd.name.toLowerCase());
			});
		});

		it("should not have spaces in names", () => {
			SLASH_COMMANDS.forEach((cmd) => {
				expect(cmd.name.includes(" ")).toBe(false);
			});
		});
	});

	describe("Command Icons", () => {
		it("should have icons for all commands", () => {
			SLASH_COMMANDS.forEach((cmd) => {
				expect(cmd.icon.length).toBeGreaterThan(0);
			});
		});
	});

	describe("createSlashCommands", () => {
		const mockHandlers = {
			onNewSession: () => {},
			onClear: () => {},
			onSave: () => {},
			onLoad: () => {},
			onExport: () => {},
			onShowContext: () => {},
			onShowAgents: () => {},
			onShowSystem: () => {},
			onShowSkills: () => {},
			onShowPrompt: () => {},
			onCompact: () => {},
			onChangeModel: () => {},
			onSetThinking: () => {},
			onChangeDir: () => {},
			onShowLog: () => {},
			onBash: (_cmd: string) => {},
			onRead: (_path: string) => {},
			onWrite: (_path: string, _content: string) => {},
			onEdit: (_path: string) => {},
			onLs: (_path?: string) => {},
			onGrep: (_pattern: string, _path?: string) => {},
			onTree: (_path?: string) => {},
			onGit: (_args: string) => {},
			onHelp: () => {},
			onShortcuts: () => {},
			onToggleTheme: () => {},
			onSetFont: () => {},
		};

		it("should create commands with actions", () => {
			const commands = createSlashCommands(mockHandlers);
			expect(commands).toHaveLength(27);

			commands.forEach((cmd) => {
				expect(cmd.action).toBeDefined();
				expect(typeof cmd.action).toBe("function");
			});
		});

		it("should create /new command with correct action", () => {
			const commands = createSlashCommands(mockHandlers);
			const newCmd = commands.find((cmd) => cmd.name === "/new");
			expect(newCmd).toBeDefined();
			expect(newCmd?.action).toBe(mockHandlers.onNewSession);
		});

		it("should create /clear command with correct action", () => {
			const commands = createSlashCommands(mockHandlers);
			const clearCmd = commands.find((cmd) => cmd.name === "/clear");
			expect(clearCmd).toBeDefined();
			expect(clearCmd?.action).toBe(mockHandlers.onClear);
		});

		it("should create /bash command with wrapped action", () => {
			const commands = createSlashCommands(mockHandlers);
			const bashCmd = commands.find((cmd) => cmd.name === "/bash");
			expect(bashCmd).toBeDefined();
			expect(typeof bashCmd?.action).toBe("function");
		});
	});

	describe("Command Descriptions", () => {
		it("should have meaningful descriptions", () => {
			SLASH_COMMANDS.forEach((cmd) => {
				expect(cmd.description.length).toBeGreaterThan(3);
				expect(cmd.description.length).toBeLessThan(50);
			});
		});

		it("should not have trailing periods in descriptions", () => {
			SLASH_COMMANDS.forEach((cmd) => {
				expect(cmd.description.endsWith(".")).toBe(false);
			});
		});
	});
});

console.log("[Test] SlashCommands tests loaded");
