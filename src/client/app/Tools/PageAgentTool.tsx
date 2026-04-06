/**
 * PageAgentTool - Page Agent 工具
 * 职责：加载/控制 page-agent
 */

import { useCallback, useState } from "react";
import { IconMenuItem } from "@/components/IconButton/IconButton";

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
		<IconMenuItem
			icon="robot"
			label="Page Agent"
			checked={isVisible}
			onClick={toggle}
			title={isVisible ? "Hide Page Agent" : "Show Page Agent"}
		/>
	);
}
