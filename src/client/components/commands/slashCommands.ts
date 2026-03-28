/**
 * Slash Commands - 27个斜杠命令定义
 */

export interface SlashCommand {
	name: string;
	description: string;
	category: "session" | "context" | "tools" | "help";
	icon: string;
	action: () => void;
}

export const SLASH_COMMANDS: Omit<SlashCommand, "action">[] = [
	// Session commands
	{ name: "/new", description: "Start a new session", category: "session", icon: "📄" },
	{ name: "/clear", description: "Clear current session messages", category: "session", icon: "🧹" },
	{ name: "/save", description: "Save current session", category: "session", icon: "💾" },
	{ name: "/load", description: "Load a saved session", category: "session", icon: "📂" },
	{ name: "/export", description: "Export session to JSON", category: "session", icon: "📤" },

	// Context commands
	{ name: "/context", description: "Show current context info", category: "context", icon: "📋" },
	{ name: "/agents", description: "View AGENTS.md", category: "context", icon: "📄" },
	{ name: "/system", description: "View SYSTEM.md", category: "context", icon: "⚙️" },
	{ name: "/skills", description: "View available skills", category: "context", icon: "🎯" },
	{ name: "/prompt", description: "Show full system prompt", category: "context", icon: "💬" },
	{ name: "/compact", description: "Compact context (summarize)", category: "context", icon: "🗜️" },
	{ name: "/model", description: "Change AI model", category: "context", icon: "🤖" },
	{ name: "/think", description: "Set thinking level", category: "context", icon: "🧠" },
	{ name: "/dir", description: "Change working directory", category: "context", icon: "📁" },
	{ name: "/log", description: "View LLM request log", category: "context", icon: "📊" },

	// Tool commands
	{ name: "/bash", description: "Execute bash command", category: "tools", icon: "💻" },
	{ name: "/read", description: "Read file content", category: "tools", icon: "📖" },
	{ name: "/write", description: "Write to file", category: "tools", icon: "✏️" },
	{ name: "/edit", description: "Edit file", category: "tools", icon: "🔧" },
	{ name: "/ls", description: "List directory contents", category: "tools", icon: "📂" },
	{ name: "/grep", description: "Search in files", category: "tools", icon: "🔍" },
	{ name: "/tree", description: "Show directory tree", category: "tools", icon: "🌲" },
	{ name: "/git", description: "Git operations", category: "tools", icon: "🌿" },

	// Help commands
	{ name: "/help", description: "Show all commands", category: "help", icon: "❓" },
	{ name: "/shortcuts", description: "Show keyboard shortcuts", category: "help", icon: "⌨️" },
	{ name: "/theme", description: "Toggle dark/light theme", category: "help", icon: "🎨" },
	{ name: "/font", description: "Change font size", category: "help", icon: "🔤" },
];

export function createSlashCommands(handlers: {
	onNewSession: () => void;
	onClear: () => void;
	onSave: () => void;
	onLoad: () => void;
	onExport: () => void;
	onShowContext: () => void;
	onShowAgents: () => void;
	onShowSystem: () => void;
	onShowSkills: () => void;
	onShowPrompt: () => void;
	onCompact: () => void;
	onChangeModel: () => void;
	onSetThinking: () => void;
	onChangeDir: () => void;
	onShowLog: () => void;
	onBash: (cmd: string) => void;
	onRead: (path: string) => void;
	onWrite: (path: string, content: string) => void;
	onEdit: (path: string) => void;
	onLs: (path?: string) => void;
	onGrep: (pattern: string, path?: string) => void;
	onTree: (path?: string) => void;
	onGit: (args: string) => void;
	onHelp: () => void;
	onShortcuts: () => void;
	onToggleTheme: () => void;
	onSetFont: () => void;
}): SlashCommand[] {
	return [
		{
			name: "/new",
			description: "Start a new session",
			category: "session",
			icon: "📄",
			action: handlers.onNewSession,
		},
		{
			name: "/clear",
			description: "Clear current session messages",
			category: "session",
			icon: "🧹",
			action: handlers.onClear,
		},
		{ name: "/save", description: "Save current session", category: "session", icon: "💾", action: handlers.onSave },
		{ name: "/load", description: "Load a saved session", category: "session", icon: "📂", action: handlers.onLoad },
		{
			name: "/export",
			description: "Export session to JSON",
			category: "session",
			icon: "📤",
			action: handlers.onExport,
		},
		{
			name: "/context",
			description: "Show current context info",
			category: "context",
			icon: "📋",
			action: handlers.onShowContext,
		},
		{
			name: "/agents",
			description: "View AGENTS.md",
			category: "context",
			icon: "📄",
			action: handlers.onShowAgents,
		},
		{ name: "/system", description: "View SYSTEM.md", category: "context", icon: "⚙️", action: handlers.onShowSystem },
		{
			name: "/skills",
			description: "View available skills",
			category: "context",
			icon: "🎯",
			action: handlers.onShowSkills,
		},
		{
			name: "/prompt",
			description: "Show full system prompt",
			category: "context",
			icon: "💬",
			action: handlers.onShowPrompt,
		},
		{
			name: "/compact",
			description: "Compact context (summarize)",
			category: "context",
			icon: "🗜️",
			action: handlers.onCompact,
		},
		{
			name: "/model",
			description: "Change AI model",
			category: "context",
			icon: "🤖",
			action: handlers.onChangeModel,
		},
		{
			name: "/think",
			description: "Set thinking level",
			category: "context",
			icon: "🧠",
			action: handlers.onSetThinking,
		},
		{
			name: "/dir",
			description: "Change working directory",
			category: "context",
			icon: "📁",
			action: handlers.onChangeDir,
		},
		{
			name: "/log",
			description: "View LLM request log",
			category: "context",
			icon: "📊",
			action: handlers.onShowLog,
		},
		{
			name: "/bash",
			description: "Execute bash command",
			category: "tools",
			icon: "💻",
			action: () => handlers.onBash(""),
		},
		{
			name: "/read",
			description: "Read file content",
			category: "tools",
			icon: "📖",
			action: () => handlers.onRead(""),
		},
		{
			name: "/write",
			description: "Write to file",
			category: "tools",
			icon: "✏️",
			action: () => handlers.onWrite("", ""),
		},
		{ name: "/edit", description: "Edit file", category: "tools", icon: "🔧", action: () => handlers.onEdit("") },
		{
			name: "/ls",
			description: "List directory contents",
			category: "tools",
			icon: "📂",
			action: () => handlers.onLs(),
		},
		{
			name: "/grep",
			description: "Search in files",
			category: "tools",
			icon: "🔍",
			action: () => handlers.onGrep(""),
		},
		{
			name: "/tree",
			description: "Show directory tree",
			category: "tools",
			icon: "🌲",
			action: () => handlers.onTree(),
		},
		{ name: "/git", description: "Git operations", category: "tools", icon: "🌿", action: () => handlers.onGit("") },
		{ name: "/help", description: "Show all commands", category: "help", icon: "❓", action: handlers.onHelp },
		{
			name: "/shortcuts",
			description: "Show keyboard shortcuts",
			category: "help",
			icon: "⌨️",
			action: handlers.onShortcuts,
		},
		{
			name: "/theme",
			description: "Toggle dark/light theme",
			category: "help",
			icon: "🎨",
			action: handlers.onToggleTheme,
		},
		{ name: "/font", description: "Change font size", category: "help", icon: "🔤", action: handlers.onSetFont },
	];
}
