/**
 * SystemPromptModal - System Prompt Viewer
 * Displays AGENTS.md, SYSTEM.md, and Skills with Tab switching
 */

import { useEffect, useCallback } from "react";
import { useSidebarExtrasStore } from "@/stores/sidebarExtrasStore";
import type { SystemPromptTab } from "@/stores/sidebarExtrasStore";
import styles from "./SystemPromptModal.module.css";

export function SystemPromptModal() {
	const isOpen = useSidebarExtrasStore((state) => state.isSystemPromptOpen);
	const activeTab = useSidebarExtrasStore((state) => state.activeSystemPromptTab);
	const prompts = useSidebarExtrasStore((state) => state.systemPrompts);
	const closeSystemPrompt = useSidebarExtrasStore((state) => state.closeSystemPrompt);
	const setActiveTab = useSidebarExtrasStore((state) => state.setActiveSystemPromptTab);
	const setSystemPrompts = useSidebarExtrasStore((state) => state.setSystemPrompts);
	const updateContent = useSidebarExtrasStore((state) => state.updateSystemPromptContent);

	// Load system prompts on mount
	useEffect(() => {
		const loadPrompts = async () => {
			try {
				// Fetch AGENTS.md
				const agentsResponse = await fetch("/api/system/agents");
				const agentsContent = agentsResponse.ok ? await agentsResponse.text() : "Failed to load AGENTS.md";

				// Fetch SYSTEM.md
				const systemResponse = await fetch("/api/system/system");
				const systemContent = systemResponse.ok ? await systemResponse.text() : "Failed to load SYSTEM.md";

				// Fetch Skills list
				const skillsResponse = await fetch("/api/system/skills");
				const skillsData = skillsResponse.ok ? await skillsResponse.json() : { skills: [] };
				const skillsContent = formatSkillsContent(skillsData.skills || []);

				const newPrompts: SystemPromptTab[] = [
					{ id: "agents", label: "AGENTS.md", content: agentsContent },
					{ id: "system", label: "SYSTEM.md", content: systemContent },
					{ id: "skills", label: "Skills", content: skillsContent },
				];

				setSystemPrompts(newPrompts);
			} catch (error) {
				console.error("[SystemPromptModal] Failed to load prompts:", error);
			}
		};

		if (isOpen) {
			loadPrompts();
		}
	}, [isOpen, setSystemPrompts]);

	const handleClose = useCallback(() => {
		closeSystemPrompt();
	}, [closeSystemPrompt]);

	const handleTabClick = useCallback((tabId: string) => {
		setActiveTab(tabId);
	}, [setActiveTab]);

	// Close on Escape key
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isOpen) {
				handleClose();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, handleClose]);

	// Prevent body scroll when modal is open
	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [isOpen]);

	if (!isOpen) return null;

	const activePrompt = prompts.find((p) => p.id === activeTab);

	return (
		<div className={styles.overlay} onClick={handleClose}>
			<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
				<div className={styles.header}>
					<h2 className={styles.title}>System Prompt</h2>
					<button className={styles.closeBtn} onClick={handleClose} aria-label="Close">
						<CloseIcon />
					</button>
				</div>

				<div className={styles.tabBar}>
					{prompts.map((prompt) => (
						<button
							key={prompt.id}
							className={`${styles.tab} ${activeTab === prompt.id ? styles.activeTab : ""}`}
							onClick={() => handleTabClick(prompt.id)}
						>
							{prompt.label}
						</button>
					))}
				</div>

				<div className={styles.content}>
					{activePrompt ? (
						<pre className={styles.pre}>{activePrompt.content || "Loading..."}</pre>
					) : (
						<div className={styles.empty}>Select a tab to view content</div>
					)}
				</div>
			</div>
		</div>
	);
}

function formatSkillsContent(skills: Array<{ name: string; description: string }>): string {
	if (skills.length === 0) {
		return "No skills loaded.";
	}

	return skills
		.map((skill, index) => `${index + 1}. ${skill.name}\n   ${skill.description}`)
		.join("\n\n");
}

function CloseIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="20" height="20">
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}
