/**
 * DebugTool - 调试系统工具
 * 职责：加载/控制 debug-system.js
 */

import { useCallback, useState } from "react";
import styles from "@/app/Tools/Tool.module.css";

export function DebugTool() {
	const [isLoaded, setIsLoaded] = useState(false);
	const [isVisible, setIsVisible] = useState(false);

	const toggle = useCallback(() => {
		if (!isLoaded) {
			// 首次加载
			if (!document.getElementById("debug-system-script")) {
				const script = document.createElement("script");
				script.id = "debug-system-script";
				script.src = "/debug-system.js";
				script.onload = () => {
					if ((window as any).DebugSystem) {
						(window as any).DebugSystem.show();
					}
				};
				document.head.appendChild(script);
			}
			setIsLoaded(true);
			setIsVisible(true);
		} else {
			// 切换显隐
			const debugSystem = (window as any).DebugSystem;
			if (debugSystem) {
				if (isVisible) {
					debugSystem.hide();
					setIsVisible(false);
				} else {
					debugSystem.show();
					setIsVisible(true);
				}
			}
		}
	}, [isLoaded, isVisible]);

	return (
		<button
			className={`${styles.item} ${isVisible ? styles.active : ""}`}
			onClick={toggle}
			title={isVisible ? "Hide Debug" : "Show Debug"}
		>
			<BugIcon />
			<span>Debug</span>
			{isVisible && <CheckIcon />}
		</button>
	);
}

function BugIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<path d="m8 2 1.88 1.88" />
			<path d="M14.12 3.88 16 2" />
			<path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
			<path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
			<path d="M12 20v-9" />
			<path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
			<path d="M6 13H2" />
			<path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
			<path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
			<path d="M22 13h-4" />
			<path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
		</svg>
	);
}

function CheckIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} style={{ width: 14, height: 14 }}>
			<polyline points="20 6 9 17 4 12" />
		</svg>
	);
}
