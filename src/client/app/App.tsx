/**
 * App - Gateway Main Application
 */

// ===== [ANCHOR:IMPORTS] =====

import React, { Suspense, useRef } from "react";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { Footer } from "@/app/Footer";
import { LoadingScreen } from "@/app/LoadingScreen";
import { useAppStore } from "@/stores/appStore";
import "@/styles/global.css";
import styles from "@/app/App.module.css";

// Lazy load pages
const ChatPage = React.lazy(() => import("@/features/chat/page"));
const FilesPage = React.lazy(() => import("@/features/files/page"));
const OrchestrationPage = React.lazy(() => import("@/features/orchestration/page"));

// ===== [ANCHOR:KEEP_ALIVE_COMPONENT] =====

/**
 * KeepAlive - Page cache container
 * Features:
 * - Only mount on first activation
 * - Never unmount after mounting
 * - Control show/hide via display
 * - Avoid loading resources for inactive pages
 */
function KeepAlive({ active, children }: { active: boolean; children: React.ReactNode }) {
  const mountedRef = useRef(false);

  // Mark on first activation
  if (active) {
    mountedRef.current = true;
  }

  // Not activated yet, do not render
  if (!mountedRef.current) return null;

  return (
    <div
      style={{
        display: active ? "flex" : "none",
        height: "100%",
        width: "100%",
      }}
    >
      {children}
    </div>
  );
}

// ===== [ANCHOR:APP_CONTENT_COMPONENT] =====

function AppContent() {
  const { currentView } = useAppStore();

  return (
    <div className={styles.app}>
      <main className={styles.pageContainer}>
        {/* Chat */}
        <KeepAlive active={currentView === "chat"}>
          <Suspense fallback={<LoadingScreen />}>
            <ChatPage />
          </Suspense>
        </KeepAlive>

        {/* Files */}
        <KeepAlive active={currentView === "files"}>
          <Suspense fallback={<LoadingScreen />}>
            <FilesPage />
          </Suspense>
        </KeepAlive>

        {/* Orchestration (agents/prompts/skills/models/workflows) */}
        <KeepAlive active={currentView === "agents"}>
          <Suspense fallback={<LoadingScreen />}>
            <OrchestrationPage />
          </Suspense>
        </KeepAlive>
      </main>

      <Footer />
    </div>
  );
}

// ===== [ANCHOR:EXPORTS] =====

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
