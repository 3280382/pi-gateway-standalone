/**
 * useMobile Hook
 * Detect mobile devices and touch support
 */

import { useState, useEffect, useCallback } from "react";

interface MobileState {
  isMobile: boolean;
  isTablet: boolean;
  isTouch: boolean;
  isPortrait: boolean;
  sidebarOpen: boolean;
  keyboardOpen: boolean;
}

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export function useMobile(): MobileState & {
  toggleSidebar: () => void;
  closeSidebar: () => void;
  openSidebar: () => void;
} {
  const [state, setState] = useState<MobileState>({
    isMobile: false,
    isTablet: false,
    isTouch: false,
    isPortrait: true,
    sidebarOpen: false,
    keyboardOpen: false,
  });

  // Check device type
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      
      setState((prev) => ({
        ...prev,
        isMobile: width < MOBILE_BREAKPOINT,
        isTablet: width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT,
        isTouch: isTouchDevice,
        isPortrait: window.innerHeight > width,
      }));
    };

    // Initial check
    checkDevice();

    // Listen for resize
    window.addEventListener("resize", checkDevice);
    window.addEventListener("orientationchange", checkDevice);

    return () => {
      window.removeEventListener("resize", checkDevice);
      window.removeEventListener("orientationchange", checkDevice);
    };
  }, []);

  // Detect virtual keyboard (mobile)
  useEffect(() => {
    if (!state.isTouch) return;

    const handleResize = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const isKeyboardOpen = viewportHeight < window.innerHeight * 0.75;
      
      setState((prev) => ({
        ...prev,
        keyboardOpen: isKeyboardOpen,
      }));
    };

    window.visualViewport?.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, [state.isTouch]);

  // Sidebar controls
  const toggleSidebar = useCallback(() => {
    setState((prev) => ({ ...prev, sidebarOpen: !prev.sidebarOpen }));
  }, []);

  const closeSidebar = useCallback(() => {
    setState((prev) => ({ ...prev, sidebarOpen: false }));
  }, []);

  const openSidebar = useCallback(() => {
    setState((prev) => ({ ...prev, sidebarOpen: true }));
  }, []);

  return {
    ...state,
    toggleSidebar,
    closeSidebar,
    openSidebar,
  };
}

export default useMobile;
