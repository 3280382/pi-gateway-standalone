/**
 * AppLayout - Main Application Layout
 * Responsive design with mobile support
 */

import React from "react";
import { useMobile } from "@/hooks/useMobile";
import styles from "./AppLayout.module.css";

interface AppLayoutProps {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  header,
  sidebar,
  children,
}) => {
  const { isMobile, isTablet, sidebarOpen, closeSidebar } = useMobile();
  const showOverlay = (isMobile || isTablet) && sidebarOpen;

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>{header}</header>

      {/* Main Content */}
      <div className={styles.main}>
        {/* Sidebar - Desktop always visible, Mobile slide-out */}
        <aside
          className={`${styles.sidebar} ${
            sidebarOpen ? styles.sidebarOpen : ""
          } ${isMobile || isTablet ? styles.sidebarMobile : ""}`}
        >
          {sidebar}
        </aside>

        {/* Overlay for mobile */}
        {showOverlay && (
          <div className={styles.overlay} onClick={closeSidebar} />
        )}

        {/* Content Area */}
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
