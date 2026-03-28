/**
 * UIStore Unit Tests
 * 测试 UI 状态管理逻辑
 */

import { beforeEach, describe, expect, it } from "vitest";

// 模拟 UIStore 状态和操作
interface TestUIState {
	theme: "dark" | "light" | "system";
	fontSize: "tiny" | "small" | "medium" | "large" | "xlarge";
	sidebarVisible: boolean;
	activeModal: string | null;
	isCommandPaletteOpen: boolean;
}

interface TestUIActions {
	setTheme: (theme: TestUIState["theme"]) => void;
	toggleTheme: () => void;
	setFontSize: (size: TestUIState["fontSize"]) => void;
	increaseFontSize: () => void;
	decreaseFontSize: () => void;
	toggleSidebar: () => void;
	setSidebarVisible: (visible: boolean) => void;
	openModal: (modal: string) => void;
	closeModal: () => void;
	toggleCommandPalette: () => void;
	reset: () => void;
}

function createTestStore(): TestUIState & TestUIActions {
	const defaults: TestUIState = {
		theme: "dark",
		fontSize: "medium",
		sidebarVisible: true,
		activeModal: null,
		isCommandPaletteOpen: false,
	};

	const state: TestUIState = { ...defaults };

	const fontSizes: TestUIState["fontSize"][] = ["tiny", "small", "medium", "large", "xlarge"];

	return {
		...state,

		setTheme(theme: TestUIState["theme"]) {
			this.theme = theme;
		},

		toggleTheme() {
			this.theme = this.theme === "dark" ? "light" : "dark";
		},

		setFontSize(size: TestUIState["fontSize"]) {
			this.fontSize = size;
		},

		increaseFontSize() {
			const idx = fontSizes.indexOf(this.fontSize);
			this.fontSize = fontSizes[Math.min(idx + 1, fontSizes.length - 1)];
		},

		decreaseFontSize() {
			const idx = fontSizes.indexOf(this.fontSize);
			this.fontSize = fontSizes[Math.max(idx - 1, 0)];
		},

		toggleSidebar() {
			this.sidebarVisible = !this.sidebarVisible;
		},

		setSidebarVisible(visible: boolean) {
			this.sidebarVisible = visible;
		},

		openModal(modal: string) {
			this.activeModal = modal;
		},

		closeModal() {
			this.activeModal = null;
		},

		toggleCommandPalette() {
			this.isCommandPaletteOpen = !this.isCommandPaletteOpen;
		},

		reset() {
			this.theme = defaults.theme;
			this.fontSize = defaults.fontSize;
			this.sidebarVisible = defaults.sidebarVisible;
			this.activeModal = defaults.activeModal;
			this.isCommandPaletteOpen = defaults.isCommandPaletteOpen;
		},
	};
}

describe("UIStore", () => {
	let store: ReturnType<typeof createTestStore>;

	beforeEach(() => {
		store = createTestStore();
	});

	describe("Theme", () => {
		it("should have default dark theme", () => {
			expect(store.theme).toBe("dark");
		});

		it("should set theme", () => {
			store.setTheme("light");
			expect(store.theme).toBe("light");
		});

		it("should toggle theme", () => {
			store.toggleTheme();
			expect(store.theme).toBe("light");
			store.toggleTheme();
			expect(store.theme).toBe("dark");
		});

		it("should set system theme", () => {
			store.setTheme("system");
			expect(store.theme).toBe("system");
		});
	});

	describe("Font Size", () => {
		it("should have default medium font size", () => {
			expect(store.fontSize).toBe("medium");
		});

		it("should set font size", () => {
			store.setFontSize("large");
			expect(store.fontSize).toBe("large");
		});

		it("should increase font size", () => {
			store.setFontSize("small");
			store.increaseFontSize();
			expect(store.fontSize).toBe("medium");
		});

		it("should not increase beyond xlarge", () => {
			store.setFontSize("xlarge");
			store.increaseFontSize();
			expect(store.fontSize).toBe("xlarge");
		});

		it("should decrease font size", () => {
			store.setFontSize("large");
			store.decreaseFontSize();
			expect(store.fontSize).toBe("medium");
		});

		it("should not decrease below tiny", () => {
			store.setFontSize("tiny");
			store.decreaseFontSize();
			expect(store.fontSize).toBe("tiny");
		});

		it("should cycle through all font sizes", () => {
			const sizes: TestUIState["fontSize"][] = ["tiny", "small", "medium", "large", "xlarge"];
			store.setFontSize("tiny");

			sizes.slice(1).forEach((expectedSize) => {
				store.increaseFontSize();
				expect(store.fontSize).toBe(expectedSize);
			});
		});
	});

	describe("Sidebar", () => {
		it("should have sidebar visible by default", () => {
			expect(store.sidebarVisible).toBe(true);
		});

		it("should toggle sidebar", () => {
			store.toggleSidebar();
			expect(store.sidebarVisible).toBe(false);
			store.toggleSidebar();
			expect(store.sidebarVisible).toBe(true);
		});

		it("should set sidebar visibility", () => {
			store.setSidebarVisible(false);
			expect(store.sidebarVisible).toBe(false);
		});
	});

	describe("Modal", () => {
		it("should have no active modal by default", () => {
			expect(store.activeModal).toBeNull();
		});

		it("should open modal", () => {
			store.openModal("settings");
			expect(store.activeModal).toBe("settings");
		});

		it("should close modal", () => {
			store.openModal("settings");
			store.closeModal();
			expect(store.activeModal).toBeNull();
		});

		it("should switch modals", () => {
			store.openModal("settings");
			store.openModal("about");
			expect(store.activeModal).toBe("about");
		});
	});

	describe("Command Palette", () => {
		it("should be closed by default", () => {
			expect(store.isCommandPaletteOpen).toBe(false);
		});

		it("should toggle command palette", () => {
			store.toggleCommandPalette();
			expect(store.isCommandPaletteOpen).toBe(true);
			store.toggleCommandPalette();
			expect(store.isCommandPaletteOpen).toBe(false);
		});
	});

	describe("Reset", () => {
		it("should reset to defaults", () => {
			// Modify all settings
			store.setTheme("light");
			store.setFontSize("xlarge");
			store.setSidebarVisible(false);
			store.openModal("settings");
			store.toggleCommandPalette();

			store.reset();

			expect(store.theme).toBe("dark");
			expect(store.fontSize).toBe("medium");
			expect(store.sidebarVisible).toBe(true);
			expect(store.activeModal).toBeNull();
			expect(store.isCommandPaletteOpen).toBe(false);
		});
	});
});

console.log("[Test] UIStore tests loaded");
