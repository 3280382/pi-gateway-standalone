import React from "react";

/**
 * MessageItem Component Tests
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Message } from "@/types/chat";
import { MessageItem } from "./MessageItem";

describe("MessageItem", () => {
	const mockMessage: Message = {
		id: "msg-1",
		role: "assistant",
		content: [{ type: "text", text: "Hello world" }],
		timestamp: new Date(),
		isMessageCollapsed: false,
		isThinkingCollapsed: false,
	};

	const mockUserMessage: Message = {
		id: "msg-2",
		role: "user",
		content: [{ type: "text", text: "Hi there" }],
		timestamp: new Date(),
	};

	const defaultProps = {
		message: mockMessage,
		showThinking: true,
		onToggleCollapse: vi.fn(),
		onToggleThinking: vi.fn(),
	};

	it("renders assistant message correctly", () => {
		render(<MessageItem {...defaultProps} />);
		expect(screen.getByText("AI")).toBeInTheDocument();
		expect(screen.getByText("Hello world")).toBeInTheDocument();
	});

	it("renders user message correctly", () => {
		render(<MessageItem {...defaultProps} message={mockUserMessage} />);
		expect(screen.getByText("You")).toBeInTheDocument();
		expect(screen.getByText("Hi there")).toBeInTheDocument();
	});

	it("calls onToggleCollapse when collapse button clicked", () => {
		render(<MessageItem {...defaultProps} />);
		// Trigger mouse enter to show actions
		const messageDiv = screen.getByText("AI").closest("[class*='_message_']") ||
			screen.getByText("AI").parentElement?.parentElement;
		if (messageDiv) {
			fireEvent.mouseEnter(messageDiv);
		}
		// Find the collapse button by its text content (−)
		const collapseBtn = screen.getByText("−");
		fireEvent.click(collapseBtn);
		expect(defaultProps.onToggleCollapse).toHaveBeenCalled();
	});

	it("renders thinking block when present and showThinking is true", () => {
		const messageWithThinking: Message = {
			...mockMessage,
			content: [
				{ type: "thinking", thinking: "Let me think..." },
				{ type: "text", text: "Result" },
			],
		};
		render(<MessageItem {...defaultProps} message={messageWithThinking} />);
		expect(screen.getByText("💭 Thinking")).toBeInTheDocument();
		expect(screen.getByText("Let me think...")).toBeInTheDocument();
	});

	it("hides thinking block when showThinking is false", () => {
		const messageWithThinking: Message = {
			...mockMessage,
			content: [
				{ type: "thinking", thinking: "Let me think..." },
				{ type: "text", text: "Result" },
			],
		};
		render(
			<MessageItem
				{...defaultProps}
				message={messageWithThinking}
				showThinking={false}
			/>,
		);
		expect(screen.queryByText("💭 Thinking")).not.toBeInTheDocument();
	});
});
