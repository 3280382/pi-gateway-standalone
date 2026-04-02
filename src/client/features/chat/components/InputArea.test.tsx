import React from "react";

/**
 * InputArea - UI Tests
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InputArea } from "./InputArea";

describe("InputArea UI", () => {
	it("should render input field", () => {
		render(
			<InputArea
				value=""
				isStreaming={false}
				onChange={vi.fn()}
				onSend={vi.fn()}
				onAbort={vi.fn()}
			/>,
		);

		expect(screen.getByPlaceholderText("Message...")).toBeInTheDocument();
	});

	it("should call onChange when typing", () => {
		const onChange = vi.fn();
		render(
			<InputArea
				value=""
				isStreaming={false}
				onChange={onChange}
				onSend={vi.fn()}
				onAbort={vi.fn()}
			/>,
		);

		const input = screen.getByPlaceholderText("Message...");
		fireEvent.change(input, { target: { value: "Hello" } });

		expect(onChange).toHaveBeenCalledWith("Hello");
	});

	it("should call onSend when clicking send button", () => {
		const onSend = vi.fn();
		render(
			<InputArea
				value="Test message"
				isStreaming={false}
				onChange={vi.fn()}
				onSend={onSend}
				onAbort={vi.fn()}
			/>,
		);

		const sendButton = screen.getByTitle("Send");
		fireEvent.click(sendButton);

		expect(onSend).toHaveBeenCalled();
	});

	it("should show stop button when streaming", () => {
		render(
			<InputArea
				value=""
				isStreaming={true}
				onChange={vi.fn()}
				onSend={vi.fn()}
				onAbort={vi.fn()}
			/>,
		);

		expect(screen.getByTitle("Stop")).toBeInTheDocument();
	});

	it("should call onAbort when clicking stop button", () => {
		const onAbort = vi.fn();
		render(
			<InputArea
				value=""
				isStreaming={true}
				onChange={vi.fn()}
				onSend={vi.fn()}
				onAbort={onAbort}
			/>,
		);

		const stopButton = screen.getByTitle("Stop");
		fireEvent.click(stopButton);

		expect(onAbort).toHaveBeenCalled();
	});
});
