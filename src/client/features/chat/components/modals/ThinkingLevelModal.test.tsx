import React from "react";

/**
 * ThinkingLevelModal Component Tests
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type ThinkingLevel = "none" | "low" | "medium" | "high";

// Simple ThinkingLevelModal for testing
function ThinkingLevelModal({
	isOpen,
	onClose,
	currentLevel,
	onSelectLevel,
}: {
	isOpen: boolean;
	onClose: () => void;
	currentLevel: ThinkingLevel;
	onSelectLevel: (level: ThinkingLevel) => void;
}) {
	if (!isOpen) return null;

	const levels: { id: ThinkingLevel; name: string; description: string }[] = [
		{ id: "none", name: "None", description: "No thinking" },
		{ id: "low", name: "Low", description: "Minimal thinking" },
		{ id: "medium", name: "Medium", description: "Balanced" },
		{ id: "high", name: "High", description: "Deep thinking" },
	];

	return (
		<div data-testid="thinking-level-modal">
			<h2>Select Thinking Level</h2>
			<div data-testid="level-list">
				{levels.map((level) => (
					<div
						key={level.id}
						data-testid={`level-${level.id}`}
						onClick={() => onSelectLevel(level.id)}
					>
						<span>{level.name}</span>
						<span>{level.description}</span>
						{currentLevel === level.id && <span data-testid="selected">✓</span>}
					</div>
				))}
			</div>
			<button data-testid="close-btn" onClick={onClose}>
				Close
			</button>
		</div>
	);
}

describe("ThinkingLevelModal", () => {
	const defaultProps = {
		isOpen: true,
		onClose: vi.fn(),
		currentLevel: "medium" as ThinkingLevel,
		onSelectLevel: vi.fn(),
	};

	it("renders nothing when closed", () => {
		const { container } = render(
			<ThinkingLevelModal {...defaultProps} isOpen={false} />,
		);
		expect(container.firstChild).toBeNull();
	});

	it("renders modal when open", () => {
		render(<ThinkingLevelModal {...defaultProps} />);
		expect(screen.getByTestId("thinking-level-modal")).toBeInTheDocument();
	});

	it("displays all thinking levels", () => {
		render(<ThinkingLevelModal {...defaultProps} />);
		expect(screen.getByTestId("level-none")).toHaveTextContent("None");
		expect(screen.getByTestId("level-low")).toHaveTextContent("Low");
		expect(screen.getByTestId("level-medium")).toHaveTextContent("Medium");
		expect(screen.getByTestId("level-high")).toHaveTextContent("High");
	});

	it("shows description for each level", () => {
		render(<ThinkingLevelModal {...defaultProps} />);
		expect(screen.getByTestId("level-none")).toHaveTextContent("No thinking");
		expect(screen.getByTestId("level-low")).toHaveTextContent(
			"Minimal thinking",
		);
		expect(screen.getByTestId("level-high")).toHaveTextContent("Deep thinking");
	});

	it("marks current level as selected", () => {
		render(<ThinkingLevelModal {...defaultProps} currentLevel="high" />);
		expect(screen.getByTestId("level-high")).toContainElement(
			screen.getByTestId("selected"),
		);
	});

	it("calls onSelectLevel when level clicked", () => {
		const onSelectLevel = vi.fn();
		render(
			<ThinkingLevelModal {...defaultProps} onSelectLevel={onSelectLevel} />,
		);
		fireEvent.click(screen.getByTestId("level-low"));
		expect(onSelectLevel).toHaveBeenCalledWith("low");
	});

	it("calls onClose when close button clicked", () => {
		const onClose = vi.fn();
		render(<ThinkingLevelModal {...defaultProps} onClose={onClose} />);
		fireEvent.click(screen.getByTestId("close-btn"));
		expect(onClose).toHaveBeenCalled();
	});

	it("handles all thinking level values", () => {
		const levels: ThinkingLevel[] = ["none", "low", "medium", "high"];
		levels.forEach((level) => {
			const { rerender } = render(
				<ThinkingLevelModal {...defaultProps} currentLevel={level} />,
			);
			expect(screen.getByTestId(`level-${level}`)).toContainElement(
				screen.getByTestId("selected"),
			);
			rerender(<></>);
		});
	});
});

console.log("[Test] ThinkingLevelModal tests loaded");
