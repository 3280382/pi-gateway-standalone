/**
 * Terminal Store - 多终端会话状态管理
 *
 * Responsibilities:
 * - 管理多个终端会话
 * - 处理终端输出流
 * - 与 TerminalWebSocketService 集成
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { terminalWebSocketService } from "@/services/terminal-websocket.service";

// ============================================================================
// Types
// ============================================================================

export interface TerminalSessionState {
  id: string;
  name: string;
  workingDir: string;
  createdAt: string;
  output: string; // Accumulated output
  isActive: boolean; // Is process running
  isConnected: boolean; // Is WebSocket attached
}

export interface TerminalState {
  // Sessions
  sessions: Map<string, TerminalSessionState>;
  activeSessionId: string | null;

  // UI State
  isPanelOpen: boolean;
  panelHeight: number;

  // Connection State
  isConnected: boolean;
  error: string | null;
}

export interface TerminalActions {
  // Session Management
  createSession: (name?: string, workingDir?: string) => void;
  closeSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string | null) => void;
  renameSession: (sessionId: string, name: string) => void;

  // Output Management
  appendOutput: (sessionId: string, data: string, isError?: boolean) => void;
  clearOutput: (sessionId: string) => void;

  // Command Execution
  executeCommand: (sessionId: string, command: string) => void;
  resizeTerminal: (sessionId: string, cols: number, rows: number) => void;

  // Connection
  connect: () => Promise<void>;
  disconnect: () => void;
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;

  // UI
  setPanelOpen: (open: boolean) => void;
  setPanelHeight: (height: number) => void;
  togglePanel: () => void;

  // Session State Updates
  markSessionActive: (sessionId: string, active: boolean) => void;
  markSessionConnected: (sessionId: string, connected: boolean) => void;
  updateSessionInfo: (sessionId: string, info: Partial<TerminalSessionState>) => void;

  // Getters
  getSession: (sessionId: string) => TerminalSessionState | undefined;
  getActiveSession: () => TerminalSessionState | undefined;
  getSessionCount: () => number;
}

// ============================================================================
// Store
// ============================================================================

export const useTerminalStore = create<TerminalState & TerminalActions>()(
  devtools(
    (set, get) => ({
      // Initial State
      sessions: new Map(),
      activeSessionId: null,
      isPanelOpen: false,
      panelHeight: 300,
      isConnected: false,
      error: null,

      // ========================================================================
      // Session Management
      // ========================================================================

      createSession: (name?: string, workingDir?: string) => {
        const success = terminalWebSocketService.createSession({
          name,
          workingDir,
          cols: 80,
          rows: 24,
        });

        if (!success) {
          set({ error: "Failed to create session: not connected" }, false, "createSession/error");
        }
      },

      closeSession: (sessionId: string) => {
        const { sessions, activeSessionId } = get();

        // Close on server
        terminalWebSocketService.closeSession(sessionId);

        // Remove from state
        const newSessions = new Map(sessions);
        newSessions.delete(sessionId);

        // Update active session if needed
        let newActiveId = activeSessionId;
        if (activeSessionId === sessionId) {
          const remaining = Array.from(newSessions.keys());
          newActiveId = remaining.length > 0 ? remaining[0] : null;
        }

        set(
          {
            sessions: newSessions,
            activeSessionId: newActiveId,
          },
          false,
          "closeSession"
        );
      },

      setActiveSession: (sessionId: string | null) => {
        set({ activeSessionId: sessionId }, false, "setActiveSession");

        // Attach to session if exists
        if (sessionId) {
          const session = get().sessions.get(sessionId);
          if (session && !session.isConnected) {
            terminalWebSocketService.attachToSession(sessionId);
          }
        }
      },

      renameSession: (sessionId: string, name: string) => {
        const { sessions } = get();
        const session = sessions.get(sessionId);
        if (!session) return;

        const newSessions = new Map(sessions);
        newSessions.set(sessionId, { ...session, name });

        set({ sessions: newSessions }, false, "renameSession");
      },

      // ========================================================================
      // Output Management
      // ========================================================================

      appendOutput: (sessionId: string, data: string, isError = false) => {
        const { sessions } = get();
        const session = sessions.get(sessionId);
        if (!session) return;

        const newSessions = new Map(sessions);
        const prefix = isError ? "\x1b[31m" : "";
        const suffix = isError ? "\x1b[0m" : "";
        newSessions.set(sessionId, {
          ...session,
          output: session.output + prefix + data + suffix,
        });

        set({ sessions: newSessions }, false, "appendOutput");
      },

      clearOutput: (sessionId: string) => {
        const { sessions } = get();
        const session = sessions.get(sessionId);
        if (!session) return;

        const newSessions = new Map(sessions);
        newSessions.set(sessionId, { ...session, output: "" });

        set({ sessions: newSessions }, false, "clearOutput");
      },

      // ========================================================================
      // Command Execution
      // ========================================================================

      executeCommand: (sessionId: string, command: string) => {
        const success = terminalWebSocketService.executeCommand(sessionId, command);

        if (!success) {
          // Add error to output
          get().appendOutput(sessionId, `Failed to send command: not connected\r\n`, true);
        }
        // Note: Command echo is handled in xterm directly, not through store
        // to avoid duplicate display and stale closure issues
      },

      resizeTerminal: (sessionId: string, cols: number, rows: number) => {
        terminalWebSocketService.resizeTerminal(sessionId, cols, rows);
      },

      // ========================================================================
      // Connection
      // ========================================================================

      connect: async () => {
        try {
          await terminalWebSocketService.connect();
          set({ isConnected: true, error: null }, false, "connect");
        } catch (error) {
          set(
            {
              isConnected: false,
              error: error instanceof Error ? error.message : "Connection failed",
            },
            false,
            "connect/error"
          );
        }
      },

      disconnect: () => {
        terminalWebSocketService.disconnect();
        set({ isConnected: false }, false, "disconnect");
      },

      setConnected: (connected: boolean) => {
        set({ isConnected: connected }, false, "setConnected");
      },

      setError: (error: string | null) => {
        set({ error }, false, "setError");
      },

      // ========================================================================
      // UI
      // ========================================================================

      setPanelOpen: (open: boolean) => {
        set({ isPanelOpen: open }, false, "setPanelOpen");
      },

      setPanelHeight: (height: number) => {
        set({ panelHeight: Math.max(100, Math.min(800, height)) }, false, "setPanelHeight");
      },

      togglePanel: () => {
        set((state) => ({ isPanelOpen: !state.isPanelOpen }), false, "togglePanel");
      },

      // ========================================================================
      // Session State Updates
      // ========================================================================

      markSessionActive: (sessionId: string, active: boolean) => {
        const { sessions } = get();
        const session = sessions.get(sessionId);
        if (!session) return;

        const newSessions = new Map(sessions);
        newSessions.set(sessionId, { ...session, isActive: active });

        set({ sessions: newSessions }, false, "markSessionActive");
      },

      markSessionConnected: (sessionId: string, connected: boolean) => {
        const { sessions } = get();
        const session = sessions.get(sessionId);
        if (!session) return;

        const newSessions = new Map(sessions);
        newSessions.set(sessionId, { ...session, isConnected: connected });

        set({ sessions: newSessions }, false, "markSessionConnected");
      },

      updateSessionInfo: (sessionId: string, info: Partial<TerminalSessionState>) => {
        const { sessions } = get();
        const session = sessions.get(sessionId);
        if (!session) return;

        const newSessions = new Map(sessions);
        newSessions.set(sessionId, { ...session, ...info });

        set({ sessions: newSessions }, false, "updateSessionInfo");
      },

      // ========================================================================
      // Getters
      // ========================================================================

      getSession: (sessionId: string) => {
        return get().sessions.get(sessionId);
      },

      getActiveSession: () => {
        const { sessions, activeSessionId } = get();
        return activeSessionId ? sessions.get(activeSessionId) : undefined;
      },

      getSessionCount: () => {
        return get().sessions.size;
      },
    }),
    { name: "TerminalStore" }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectSessions = (state: ReturnType<typeof useTerminalStore.getState>) =>
  Array.from(state.sessions.values());

export const selectActiveSession = (state: ReturnType<typeof useTerminalStore.getState>) =>
  state.activeSessionId ? state.sessions.get(state.activeSessionId) : undefined;

export const selectIsPanelOpen = (state: ReturnType<typeof useTerminalStore.getState>) =>
  state.isPanelOpen;

export const selectPanelHeight = (state: ReturnType<typeof useTerminalStore.getState>) =>
  state.panelHeight;
