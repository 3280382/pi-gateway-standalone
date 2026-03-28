/**
 * UI Store - UI State Management
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

// ============================================================================
// Types
// ============================================================================

export type Theme = "dark" | "light" | "system";
export type FontSize = "tiny" | "small" | "medium" | "large" | "xlarge";

export type ModalType =
	| "systemPrompt"
	| "llmLog"
	| "modelSelector"
	| "thinkingSelector"
	| "settings"
	| "keyboardShortcuts"
	| "about"
	| null;

export interface Toast {
	id: string;
	message: string;
	type: "info" | "success" | "warning" | "error";
	duration?: number;
}

export interface UIState {
	// Theme
	theme: Theme;
	followSystemTheme: boolean;

	// Typography
	fontSize: FontSize;
	fontFamily: string;
	lineHeight: "compact" | "normal" | "relaxed";

	// Layout
	sidebarVisible: boolean;
	sidebarWidth: number;
	chatPanelWidth: number;
	filePanelWidth: number;

	// Modals
	activeModal: ModalType;
	modalData: Record<string, unknown> | null;

	// Toast Notifications
	toasts: Toast[];

	// Tooltip
	tooltip: {
		visible: boolean;
		content: string;
		x: number;
		y: number;
	};

	// Drag & Drop
	isDragging: boolean;
	dragData: unknown;

	// Focus
	focusedPanel: "sidebar" | "chat" | "files" | null;

	// Keyboard
	isCommandPaletteOpen: boolean;
}

interface UIActions {
	// Theme Actions
	setTheme: (theme: Theme) => void;
	toggleTheme: () => void;
	setFollowSystemTheme: (follow: boolean) => void;

	// Font Actions
	setFontSize: (size: FontSize) => void;
	increaseFontSize: () => void;
	decreaseFontSize: () => void;
	setFontFamily: (family: string) => void;
	setLineHeight: (height: "compact" | "normal" | "relaxed") => void;

	// Layout Actions
	toggleSidebar: () => void;
	setSidebarVisible: (visible: boolean) => void;
	setSidebarWidth: (width: number) => void;
	setChatPanelWidth: (width: number) => void;
	setFilePanelWidth: (width: number) => void;

	// Modal Actions
	openModal: (modal: Exclude<ModalType, null>, data?: Record<string, unknown>) => void;
	closeModal: () => void;
	toggleModal: (modal: Exclude<ModalType, null>) => void;

	// Toast Actions
	showToast: (message: string, type?: Toast["type"], duration?: number) => string;
	removeToast: (id: string) => void;
	clearToasts: () => void;

	// Tooltip Actions
	showTooltip: (content: string, x: number, y: number) => void;
	hideTooltip: () => void;

	// Drag & Drop Actions
	startDrag: (data: unknown) => void;
	endDrag: () => void;

	// Focus Actions
	setFocusedPanel: (panel: UIState["focusedPanel"]) => void;

	// Command Palette Actions
	openCommandPalette: () => void;
	closeCommandPalette: () => void;
	toggleCommandPalette: () => void;

	// Reset
	reset: () => void;
}

// ============================================================================
// Initial State Factory
// ============================================================================

const createInitialState = (): Omit<UIState, keyof UIActions> => ({
	theme: "dark",
	followSystemTheme: true,
	fontSize: "medium",
	fontFamily: "system-ui, -apple-system, sans-serif",
	lineHeight: "normal",
	sidebarVisible: true,
	sidebarWidth: 280,
	chatPanelWidth: 50, // percentage
	filePanelWidth: 50, // percentage
	activeModal: null,
	modalData: null,
	toasts: [],
	tooltip: {
		visible: false,
		content: "",
		x: 0,
		y: 0,
	},
	isDragging: false,
	dragData: null,
	focusedPanel: null,
	isCommandPaletteOpen: false,
});

// ============================================================================
// Helper Functions
// ============================================================================

function generateToastId(): string {
	return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getNextFontSize(current: FontSize): FontSize {
	const sizes: FontSize[] = ["tiny", "small", "medium", "large", "xlarge"];
	const idx = sizes.indexOf(current);
	return sizes[Math.min(idx + 1, sizes.length - 1)];
}

function getPrevFontSize(current: FontSize): FontSize {
	const sizes: FontSize[] = ["tiny", "small", "medium", "large", "xlarge"];
	const idx = sizes.indexOf(current);
	return sizes[Math.max(idx - 1, 0)];
}

function applyTheme(theme: Theme) {
	if (theme === "system") {
		const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
		document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
	} else {
		document.documentElement.setAttribute("data-theme", theme);
	}
}

function applyFontSize(size: FontSize) {
	const sizeMap: Record<FontSize, string> = {
		tiny: "12px",
		small: "14px",
		medium: "16px",
		large: "18px",
		xlarge: "20px",
	};
	document.documentElement.style.setProperty("--base-font-size", sizeMap[size]);
}

// ============================================================================
// Store Creation
// ============================================================================

export const useUIStore = create<UIState & UIActions>()(
	devtools(
		persist(
			(set, get) => ({
				...createInitialState(),

				// Theme Actions
				setTheme: (theme: Theme) => {
					set({ theme }, false, "setTheme");
					applyTheme(theme);
				},

				toggleTheme: () => {
					const newTheme = get().theme === "dark" ? "light" : "dark";
					set({ theme: newTheme }, false, "toggleTheme");
					applyTheme(newTheme);
				},

				setFollowSystemTheme: (follow: boolean) => {
					set({ followSystemTheme: follow }, false, "setFollowSystemTheme");
					if (follow) {
						applyTheme("system");
					}
				},

				// Font Actions
				setFontSize: (size: FontSize) => {
					set({ fontSize: size }, false, "setFontSize");
					applyFontSize(size);
				},

				increaseFontSize: () => {
					const newSize = getNextFontSize(get().fontSize);
					set({ fontSize: newSize }, false, "increaseFontSize");
					applyFontSize(newSize);
				},

				decreaseFontSize: () => {
					const newSize = getPrevFontSize(get().fontSize);
					set({ fontSize: newSize }, false, "decreaseFontSize");
					applyFontSize(newSize);
				},

				setFontFamily: (family: string) => {
					set({ fontFamily: family }, false, "setFontFamily");
					document.documentElement.style.setProperty("--font-family", family);
				},

				setLineHeight: (height: "compact" | "normal" | "relaxed") => {
					set({ lineHeight: height }, false, "setLineHeight");
					const heightMap = {
						compact: "1.4",
						normal: "1.6",
						relaxed: "1.8",
					};
					document.documentElement.style.setProperty("--line-height", heightMap[height]);
				},

				// Layout Actions
				toggleSidebar: () => {
					set((state) => ({ sidebarVisible: !state.sidebarVisible }), false, "toggleSidebar");
				},

				setSidebarVisible: (visible: boolean) => {
					set({ sidebarVisible: visible }, false, "setSidebarVisible");
				},

				setSidebarWidth: (width: number) => {
					set({ sidebarWidth: Math.max(200, Math.min(500, width)) }, false, "setSidebarWidth");
				},

				setChatPanelWidth: (width: number) => {
					set({ chatPanelWidth: Math.max(20, Math.min(80, width)) }, false, "setChatPanelWidth");
				},

				setFilePanelWidth: (width: number) => {
					set({ filePanelWidth: Math.max(20, Math.min(80, width)) }, false, "setFilePanelWidth");
				},

				// Modal Actions
				openModal: (modal: Exclude<ModalType, null>, data?: Record<string, unknown>) => {
					set({ activeModal: modal, modalData: data || null }, false, "openModal");
				},

				closeModal: () => {
					set({ activeModal: null, modalData: null }, false, "closeModal");
				},

				toggleModal: (modal: Exclude<ModalType, null>) => {
					const { activeModal } = get();
					if (activeModal === modal) {
						set({ activeModal: null, modalData: null }, false, "toggleModal");
					} else {
						set({ activeModal: modal, modalData: null }, false, "toggleModal");
					}
				},

				// Toast Actions
				showToast: (message: string, type: Toast["type"] = "info", duration = 3000): string => {
					const id = generateToastId();
					const toast: Toast = { id, message, type, duration };
					set((state) => ({ toasts: [...state.toasts, toast] }), false, "showToast");

					// Auto-remove toast
					if (duration > 0) {
						setTimeout(() => {
							get().removeToast(id);
						}, duration);
					}

					return id;
				},

				removeToast: (id: string) => {
					set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }), false, "removeToast");
				},

				clearToasts: () => {
					set({ toasts: [] }, false, "clearToasts");
				},

				// Tooltip Actions
				showTooltip: (content: string, x: number, y: number) => {
					set({ tooltip: { visible: true, content, x, y } }, false, "showTooltip");
				},

				hideTooltip: () => {
					set((state) => ({ tooltip: { ...state.tooltip, visible: false } }), false, "hideTooltip");
				},

				// Drag & Drop Actions
				startDrag: (data: unknown) => {
					set({ isDragging: true, dragData: data }, false, "startDrag");
				},

				endDrag: () => {
					set({ isDragging: false, dragData: null }, false, "endDrag");
				},

				// Focus Actions
				setFocusedPanel: (panel: UIState["focusedPanel"]) => {
					set({ focusedPanel: panel }, false, "setFocusedPanel");
				},

				// Command Palette Actions
				openCommandPalette: () => {
					set({ isCommandPaletteOpen: true }, false, "openCommandPalette");
				},

				closeCommandPalette: () => {
					set({ isCommandPaletteOpen: false }, false, "closeCommandPalette");
				},

				toggleCommandPalette: () => {
					set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen }), false, "toggleCommandPalette");
				},

				// Reset
				reset: () => {
					set(createInitialState(), false, "reset");
				},
			}),
			{
				name: "ui-storage",
				partialize: (state) => ({
					theme: state.theme,
					followSystemTheme: state.followSystemTheme,
					fontSize: state.fontSize,
					fontFamily: state.fontFamily,
					lineHeight: state.lineHeight,
					sidebarVisible: state.sidebarVisible,
					sidebarWidth: state.sidebarWidth,
					chatPanelWidth: state.chatPanelWidth,
					filePanelWidth: state.filePanelWidth,
				}),
				onRehydrateStorage: () => (state) => {
					// Apply persisted theme and font settings on rehydrate
					if (state) {
						applyTheme(state.theme);
						applyFontSize(state.fontSize);
					}
				},
			},
		),
		{ name: "UIStore" },
	),
);

// ============================================================================
// Selectors
// ============================================================================

export const selectTheme = (state: UIState) => state.theme;
export const selectFontSize = (state: UIState) => state.fontSize;
export const selectSidebarVisible = (state: UIState) => state.sidebarVisible;
export const selectActiveModal = (state: UIState) => state.activeModal;
export const selectModalData = (state: UIState) => state.modalData;
export const selectToasts = (state: UIState) => state.toasts;
export const selectTooltip = (state: UIState) => state.tooltip;
export const selectIsDragging = (state: UIState) => state.isDragging;
export const selectFocusedPanel = (state: UIState) => state.focusedPanel;
export const selectIsCommandPaletteOpen = (state: UIState) => state.isCommandPaletteOpen;
export const selectIsModalOpen = (modal: Exclude<ModalType, null>) => (state: UIState) => state.activeModal === modal;
