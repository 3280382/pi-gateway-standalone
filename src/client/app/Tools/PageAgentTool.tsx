/**
 * PageAgentTool - Page Agent 工具
 * 职责：加载/控制 page-agent
 */

import { useCallback, useState } from "react";
import styles from "@/app/Tools/Tool.module.css";

export function PageAgentTool() {
	const [isLoaded, setIsLoaded] = useState(false);
	const [isVisible, setIsVisible] = useState(false);

	const toggle = useCallback(() => {
		if (!isLoaded) {
			// 首次加载
			if (!document.getElementById("page-agent-script")) {
				const script = document.createElement("script");
				script.id = "page-agent-script";
				script.src = "/vendor/page-agent/page-agent.demo.js";
				script.onload = () => console.log("[Page Agent] Loaded");
				document.head.appendChild(script);
			}
			setIsLoaded(true);
			setIsVisible(true);
		} else {
			// 切换显隐
			const mask = document.querySelector(".page-agent-mask") as HTMLElement;
			if (mask) {
				if (isVisible) {
					mask.style.visibility = "hidden";
					mask.style.pointerEvents = "none";
					setIsVisible(false);
				} else {
					mask.style.visibility = "visible";
					mask.style.pointerEvents = "auto";
					setIsVisible(true);
				}
			}
		}
	}, [isLoaded, isVisible]);

	return (
		<button
			className={`${styles.item} ${isVisible ? styles.active : ""}`}
			onClick={toggle}
			title={isVisible ? "Hide Page Agent" : "Show Page Agent"}
		>
			<RobotIcon />
			<span>Page Agent</span>
			{isVisible && <CheckIcon />}
		</button>
	);
}

function RobotIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<path d="M12 8V4H8" />
			<rect width="16" height="12" x="4" y="8" rx="2" />
			<path d="M2 14h2" />
			<path d="M20 14h2" />
			<path d="M15 13v2" />
			<path d="M9 13v2" />
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
