/**
 * Layout 导出 - 统一布局层
 */

export { AppHeader } from "./AppHeader";
export { LayoutProvider, useLayout } from "./LayoutContext";
export type { ViewType, BottomPanelType } from "./LayoutContext";

// Panels
export { LlmLogPanel } from "./panels/LlmLogPanel";
export { TerminalPanel, XTermPanel } from "./panels/TerminalPanel";
