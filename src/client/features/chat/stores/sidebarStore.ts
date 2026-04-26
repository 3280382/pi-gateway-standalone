/**
 * Sidebar Store - Zustand State Management
 *
 * Responsibilities:
 * - 管理 Sidebar UI 状态
 * - 所有 session 数据来自服务器（WebSocket），不持久化到 localStorage
 * - workingDir 由全局 workspaceStore 同步（运行时副本，不持久化）
 * - recentWorkspaces 已统一到 workspaceStore
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Session, SidebarState } from "@/features/chat/types/sidebar";

// ============================================================================
// Initial State Factory
// ============================================================================

const createInitialState = (): Omit<SidebarState, keyof SidebarActions> => ({
  isVisible: false,
  isBottomPanelOpen: false,
  bottomPanelHeight: 300,
  workingDir: null,
  sessions: [],
  isLoading: false,
  error: null,
  selectedSessionId: null,
  runtimeStatus: {}, // Map of sessionId -> runtime status
});

// ============================================================================
// Actions Interface
// ============================================================================

interface SidebarActions {
  // Visibility Actions
  setIsVisible: (visible: boolean) => void;
  toggleVisibility: () => void;

  // Bottom Panel Actions
  setBottomPanelOpen: (open: boolean) => void;
  closeBottomPanel: () => void;
  setBottomPanelHeight: (height: number) => void;

  // Data Actions
  setWorkingDir: (path: string) => void;
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;

  // UI Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  selectSession: (id: string | null) => void;
  setSelectedSessionId: (id: string | null) => void;
  clearError: () => void;

  // Runtime Status Actions
  setRuntimeStatus: (sessionId: string, status: string) => void;
  updateRuntimeStatusBulk: (statuses: Array<{ sessionId: string; status: string }>) => void;

  // Session Config Actions
  updateSessionName: (sessionId: string, name: string) => void;
  removeSession: (sessionId: string) => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Store Creation
// ============================================================================

const sidebarStoreCreator = (set: any) => ({
  ...createInitialState(),

  // Visibility Actions
  setIsVisible: (visible: boolean) => {
    set({ isVisible: visible }, false, "setIsVisible");
  },

  toggleVisibility: () => {
    set((state: any) => ({ isVisible: !state.isVisible }), false, "toggleVisibility");
  },

  // Bottom Panel Actions
  setBottomPanelOpen: (open: boolean) => {
    set({ isBottomPanelOpen: open }, false, "setBottomPanelOpen");
  },

  closeBottomPanel: () => {
    set({ isBottomPanelOpen: false }, false, "closeBottomPanel");
  },

  setBottomPanelHeight: (height: number) => {
    set({ bottomPanelHeight: height }, false, "setBottomPanelHeight");
  },

  // Data Actions
  setWorkingDir: (path: string) => {
    const safePath = path || "";
    const displayName = safePath.split("/").pop() || safePath;
    // Clear old sessions when switching directories — the new list arrives
    // asynchronously via sessions_list WebSocket event.
    set(
      {
        workingDir: { path: safePath, displayName },
        sessions: [],
        runtimeStatus: {},
        selectedSessionId: null,
      },
      false,
      "setWorkingDir"
    );
  },

  setSessions: (sessions: Session[]) => {
    set({ sessions }, false, "setSessions");
  },

  addSession: (session: Session) => {
    set(
      (state: any) => ({
        sessions: [session, ...state.sessions],
      }),
      false,
      "addSession"
    );
  },

  // UI Actions
  setLoading: (loading: boolean) => {
    set({ isLoading: loading }, false, "setLoading");
  },

  setError: (error: string | null) => {
    set({ error }, false, "setError");
  },

  selectSession: (id: string | null) => {
    set({ selectedSessionId: id }, false, "selectSession");
  },

  setSelectedSessionId: (id: string | null) => {
    set({ selectedSessionId: id }, false, "setSelectedSessionId");
  },

  clearError: () => {
    set({ error: null }, false, "clearError");
  },

  // Runtime Status Actions
  setRuntimeStatus: (sessionId: string, status: string) => {
    set(
      (state: any) => ({
        runtimeStatus: { ...state.runtimeStatus, [sessionId]: status },
      }),
      false,
      "setRuntimeStatus"
    );
  },

  updateRuntimeStatusBulk: (statuses: Array<{ sessionId: string; status: string }>) => {
    set(
      (state: any) => {
        const newStatus = { ...state.runtimeStatus };
        statuses.forEach(({ sessionId, status }) => {
          newStatus[sessionId] = status;
        });
        return { runtimeStatus: newStatus };
      },
      false,
      "updateRuntimeStatusBulk"
    );
  },

  // Session Config Actions
  updateSessionName: (sessionId: string, name: string) => {
    set(
      (state: any) => ({
        sessions: state.sessions.map((s: Session) => (s.id === sessionId ? { ...s, name } : s)),
      }),
      false,
      "updateSessionName"
    );
  },

  removeSession: (sessionId: string) => {
    set(
      (state: any) => ({
        sessions: state.sessions.filter((s: Session) => s.id !== sessionId),
        selectedSessionId: state.selectedSessionId === sessionId ? null : state.selectedSessionId,
      }),
      false,
      "removeSession"
    );
  },

  // Reset
  reset: () => {
    set(createInitialState(), false, "reset");
  },
});

export const useSidebarStore = create<SidebarState & SidebarActions>()(
  devtools(sidebarStoreCreator, { name: "SidebarStore" })
);

// ============================================================================
// Selectors (for performance)
// ============================================================================

export const selectWorkingDir = (state: SidebarState) => state.workingDir;
export const selectSessions = (state: SidebarState) => state.sessions;
export const selectSelectedSessionId = (state: SidebarState) => state.selectedSessionId;
export const selectIsLoading = (state: SidebarState) => state.isLoading;
export const selectError = (state: SidebarState) => state.error;
