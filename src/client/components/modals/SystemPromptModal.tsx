/**
 * SystemPromptModal - 系统提示查看器
 */

import { useEffect, useState } from "react";
import { useModalStore } from "@/stores/modalStore";
import { useSessionStore } from "@/stores/sessionStore";
import styles from "./Modals.module.css";

interface SystemPromptData {
	systemPrompt?: string;
	appendSystemPrompt?: Array<{ path: string; content: string }>;
	skills?: Array<{ name: string; description: string }>;
	agentsFiles?: Array<{ path: string; content: string }>;
	cwd?: string;
}

export function SystemPromptModal() {
	const { isSystemPromptOpen, closeSystemPrompt } = useModalStore();
	const [data, setData] = useState<SystemPromptData | null>(null);
	const [loading, setLoading] = useState(false);
	const [activeTab, setActiveTab] = useState<
		"prompt" | "agents" | "skills" | "resources"
	>("prompt");
	const resourceFiles = useSessionStore((state) => state.resourceFiles);

	useEffect(() => {
		if (!isSystemPromptOpen) return;

		const load = async () => {
			setLoading(true);
			try {
				const res = await fetch("/api/system-prompt");
				const json = await res.json();
				setData(json);
			} catch (err) {
				console.error("Failed to load system prompt:", err);
			} finally {
				setLoading(false);
			}
		};

		load();
	}, [isSystemPromptOpen]);

	if (!isSystemPromptOpen) return null;

	return (
		<div className={styles.overlay} onClick={closeSystemPrompt}>
			<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
				<div className={styles.header}>
					<h3>System Prompt & AGENTS.md</h3>
					<button className={styles.closeBtn} onClick={closeSystemPrompt}>
						✕
					</button>
				</div>

				<div className={styles.tabs}>
					<button
						className={activeTab === "prompt" ? styles.activeTab : ""}
						onClick={() => setActiveTab("prompt")}
					>
						System Prompt
					</button>
					<button
						className={activeTab === "agents" ? styles.activeTab : ""}
						onClick={() => setActiveTab("agents")}
					>
						AGENTS.md
					</button>
					<button
						className={activeTab === "skills" ? styles.activeTab : ""}
						onClick={() => setActiveTab("skills")}
					>
						Skills ({data?.skills?.length || 0})
					</button>
					<button
						className={activeTab === "resources" ? styles.activeTab : ""}
						onClick={() => setActiveTab("resources")}
					>
						Resources
					</button>
				</div>

				<div className={styles.content}>
					{loading ? (
						<div className={styles.loading}>Loading...</div>
					) : activeTab === "prompt" ? (
						<div className={styles.promptSection}>
							<h4>⚙️ System Prompt</h4>
							<pre className={styles.code}>
								{data?.systemPrompt || "No system prompt loaded"}
							</pre>
							{data?.appendSystemPrompt &&
								data.appendSystemPrompt.length > 0 && (
									<>
										<h4>
											➕ Append System Prompt ({data.appendSystemPrompt.length})
										</h4>
										{data.appendSystemPrompt.map((file, i) => (
											<div key={i} className={styles.fileBlock}>
												<div className={styles.filePath}>{file.path}</div>
												<pre className={styles.code}>{file.content}</pre>
											</div>
										))}
									</>
								)}
						</div>
					) : activeTab === "agents" ? (
						<div className={styles.promptSection}>
							<h4>📄 AGENTS.md Files ({data?.agentsFiles?.length || 0})</h4>
							{data?.agentsFiles?.map((file, i) => (
								<div key={i} className={styles.fileBlock}>
									<div className={styles.filePath}>{file.path}</div>
									<pre className={styles.code}>{file.content}</pre>
								</div>
							))}
						</div>
					) : activeTab === "skills" ? (
						<div className={styles.skillsList}>
							{data?.skills?.map((skill, i) => (
								<details key={i} className={styles.skillItem}>
									<summary>{skill.name}</summary>
									<div className={styles.skillDescription}>
										{skill.description}
									</div>
								</details>
							))}
						</div>
					) : (
						<div className={styles.promptSection}>
							<h4>📁 Resource Files</h4>
							{resourceFiles ? (
								<>
									<div className={styles.resourceSection}>
										<h5>System Prompt</h5>
										<div className={styles.filePath}>
											Global: {resourceFiles.systemPrompt.global}
										</div>
										<div className={styles.filePath}>
											Project: {resourceFiles.systemPrompt.project}
										</div>
										<div className={styles.filePath}>
											Status: {resourceFiles.systemPrompt.loaded}
										</div>
									</div>
									<div className={styles.resourceSection}>
										<h5>Configuration</h5>
										<div className={styles.filePath}>
											Settings: {resourceFiles.settings.path}{" "}
											{resourceFiles.settings.exists ? "✓" : "✗"}
										</div>
										<div className={styles.filePath}>
											Auth: {resourceFiles.auth.path}{" "}
											{resourceFiles.auth.exists ? "✓" : "✗"}
										</div>
										<div className={styles.filePath}>
											Models: {resourceFiles.models.path}{" "}
											{resourceFiles.models.exists ? "✓" : "✗"}
										</div>
										<div className={styles.filePath}>
											Session: {resourceFiles.session.path}{" "}
											{resourceFiles.session.exists ? "✓" : "✗"}
										</div>
									</div>
									<div className={styles.resourceSection}>
										<h5>
											AGENTS.md Files ({resourceFiles.agentsFiles.length})
										</h5>
										{resourceFiles.agentsFiles.map((f, i) => (
											<div key={i} className={styles.filePath}>
												{f.path} {f.exists ? "✓" : "✗"}
											</div>
										))}
									</div>
									<div className={styles.resourceSection}>
										<h5>Skills ({resourceFiles.skills.loaded.length})</h5>
										<div className={styles.filePath}>
											Global: {resourceFiles.skills.global}
										</div>
										<div className={styles.filePath}>
											Project: {resourceFiles.skills.project}
										</div>
									</div>
								</>
							) : (
								<div className={styles.loading}>No resource files loaded</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
