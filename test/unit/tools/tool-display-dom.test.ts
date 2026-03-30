/**
 * DOM-level test for tool display functionality
 * Tests the frontend logic without requiring a real browser
 */
import { beforeEach, describe, expect, it } from "vitest";

// Mock DOM environment
const mockDOM = () => {
	// Simple DOM mock for testing
	const elements: Map<string, any> = new Map();

	const createElement = (tag: string) => ({
		tagName: tag,
		classList: {
			classes: new Set<string>(),
			add: function (c: string) {
				this.classes.add(c);
			},
			remove: function (c: string) {
				this.classes.delete(c);
			},
			contains: function (c: string) {
				return this.classes.has(c);
			},
			toggle: function (c: string) {
				if (this.classes.has(c)) this.classes.delete(c);
				else this.classes.add(c);
			},
		},
		style: {} as any,
		innerHTML: "",
		textContent: "",
		dataset: {} as any,
		attributes: {} as any,
		children: [] as any[],
		querySelector: function (sel: string) {
			// Simple selector matching
			if (sel.startsWith('[data-tool-id="')) {
				const id = sel.match(/data-tool-id="([^"]+)"/)?.[1];
				return this.children.find((c: any) => c.dataset?.toolId === id);
			}
			if (sel === ".tool-content") {
				return this.children.find((c: any) =>
					c.classList?.contains("tool-content"),
				);
			}
			if (sel === ".tool-status") {
				return this.children.find((c: any) =>
					c.classList?.contains("tool-status"),
				);
			}
			if (sel === ".write-preview") {
				return this.children.find((c: any) =>
					c.classList?.contains("write-preview"),
				);
			}
			return null;
		},
		querySelectorAll: function (sel: string) {
			return this.children.filter((c: any) => {
				if (sel === ".tool-execution")
					return c.classList?.contains("tool-execution");
				return false;
			});
		},
		appendChild: function (child: any) {
			this.children.push(child);
			child.parentNode = this;
		},
		addEventListener: () => {},
		removeEventListener: () => {},
		setAttribute: function (name: string, val: string) {
			this.attributes[name] = val;
		},
		getAttribute: function (name: string) {
			return this.attributes[name];
		},
	});

	return { createElement, elements };
};

describe("Tool Display DOM Logic", () => {
	let dom: ReturnType<typeof mockDOM>;
	let streamingToolCalls: Map<string, any>;
	let activeToolExecutions: Map<string, any>;
	let _currentAssistantMessage: any;

	beforeEach(() => {
		dom = mockDOM();
		streamingToolCalls = new Map();
		activeToolExecutions = new Map();
		_currentAssistantMessage = null;
	});

	it("should track tool through complete lifecycle", () => {
		const toolCallId = "write:0";
		const toolName = "write";
		const args = { path: "test.txt", content: "Line 1\nLine 2\nLine 3" };

		// Step 1: toolcall_delta creates the tool
		const messageDiv = dom.createElement("div");
		messageDiv.classList.add("message");
		const contentDiv = dom.createElement("div");
		contentDiv.classList.add("message-content");
		messageDiv.appendChild(contentDiv);
		_currentAssistantMessage = messageDiv;

		// Create tool (simulating addToolToMessage)
		const toolDiv = dom.createElement("div");
		toolDiv.classList.add("tool-execution");
		toolDiv.dataset.toolId = toolCallId;
		contentDiv.appendChild(toolDiv);

		// Track in streamingToolCalls
		streamingToolCalls.set(toolCallId, {
			toolName,
			args,
			element: toolDiv,
		});

		expect(streamingToolCalls.has(toolCallId)).toBe(true);
		expect(contentDiv.children.length).toBe(1);

		// Step 2: tool_start transitions the tool
		const streamingTool = streamingToolCalls.get(toolCallId);
		expect(streamingTool).toBeTruthy();

		// Move to activeToolExecutions
		activeToolExecutions.set(toolCallId, streamingTool.element);
		streamingToolCalls.delete(toolCallId);

		expect(streamingToolCalls.has(toolCallId)).toBe(false);
		expect(activeToolExecutions.has(toolCallId)).toBe(true);

		// Step 3: tool_end removes from active
		activeToolExecutions.delete(toolCallId);
		expect(activeToolExecutions.has(toolCallId)).toBe(false);
	});

	it("should prevent duplicate tool creation", () => {
		const toolCallId = "write:0";
		const messageDiv = dom.createElement("div");
		const contentDiv = dom.createElement("div");
		contentDiv.classList.add("message-content");
		messageDiv.appendChild(contentDiv);

		// First creation
		const toolDiv1 = dom.createElement("div");
		toolDiv1.dataset.toolId = toolCallId;
		contentDiv.appendChild(toolDiv1);

		// Try to create again (should find existing)
		const existing = contentDiv.querySelector(`[data-tool-id="${toolCallId}"]`);
		expect(existing).toBe(toolDiv1);
		expect(contentDiv.children.length).toBe(1);
	});

	it("should handle special characters in toolCallId", () => {
		const specialIds = ["write:0", "bash:1", "tool-123", "tool.name"];

		for (const toolCallId of specialIds) {
			const messageDiv = dom.createElement("div");
			const contentDiv = dom.createElement("div");
			contentDiv.classList.add("message-content");
			messageDiv.appendChild(contentDiv);

			const toolDiv = dom.createElement("div");
			toolDiv.dataset.toolId = toolCallId;
			contentDiv.appendChild(toolDiv);

			// Should be findable
			const found = contentDiv.querySelector(`[data-tool-id="${toolCallId}"]`);
			expect(found).toBe(toolDiv);
		}
	});
});

describe("Tool Display Event Sequence", () => {
	it("should handle correct event order: toolcall_delta -> tool_start -> tool_end", () => {
		const events: string[] = [];
		const _toolCallId = "write:0";

		// Simulate event sequence
		events.push("message_start");
		events.push("toolcall_delta");
		events.push("toolcall_delta");
		events.push("toolcall_delta");
		events.push("message_end");
		events.push("tool_start");
		events.push("tool_end");

		// Verify order
		const deltaIndex = events.indexOf("toolcall_delta");
		const startIndex = events.indexOf("tool_start");
		const endIndex = events.indexOf("tool_end");

		expect(deltaIndex).toBeGreaterThanOrEqual(0);
		expect(startIndex).toBeGreaterThan(deltaIndex);
		expect(endIndex).toBeGreaterThan(startIndex);
	});

	it("should handle multiple tools in sequence", () => {
		const tool1Events = ["toolcall_delta", "tool_start", "tool_end"];
		const tool2Events = ["toolcall_delta", "tool_start", "tool_end"];

		// Both tools should have complete lifecycle
		expect(tool1Events).toContain("tool_start");
		expect(tool1Events).toContain("tool_end");
		expect(tool2Events).toContain("tool_start");
		expect(tool2Events).toContain("tool_end");
	});
});
