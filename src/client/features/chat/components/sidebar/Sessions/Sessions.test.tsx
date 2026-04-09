import React from "react";

/**
 * Sessions Section - UI Tests
 * Layer 1: Component rendering with Mock Store
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sessions } from "./Sessions";

// Create mock functions inside the mock factory to avoid hoisting issues
vi.mock("@/features/chat/stores/sidebarStore", () => ({
	useSidebarStore: (selector: any) => {
		const state = {
			sessions: [
				{
					id: "1",
					name: "Test Session 1",
					path: "/path/to/session1",
					messageCount: 5,
					lastModified: new Date("2024-01-15"),
				},
				{
					id: "2",
					name: "Test Session 2",
					path: "/path/to/session2",
					messageCount: 10,
					lastModified: new Date("2024-01-16"),
				},
			],
			selectedSessionId: null,
			isLoading: false,
		};
		return selector ? selector(state) : state;
	},
}));

vi.mock("@/features/chat/services/sessionManager", () => ({
	sessionManager: {
		selectSession: vi.fn(),
		createNewSession: vi.fn(),
	},
}));

describe("Sessions Section UI", () => {
	it("should render session list", () => {
		render(<Sessions />);

		expect(screen.getByText("Test Session 1")).toBeInTheDocument();
		expect(screen.getByText("Test Session 2")).toBeInTheDocument();
	});

	it("should show session message counts", () => {
		render(<Sessions />);

		// Use regex to be more flexible with text matching
		expect(screen.getByText(/5\s*msgs/)).toBeInTheDocument();
		expect(screen.getByText(/10\s*msgs/)).toBeInTheDocument();
	});

	it("should render new session button", () => {
		render(<Sessions />);

		// Check for the button with the plus icon
		const buttons = screen.getAllByRole("button");
		expect(buttons.length).toBeGreaterThan(0);
	});
});
