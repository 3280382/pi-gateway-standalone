/**
 * ModelSelector - Model selection dropdown
 */

import { useState, useEffect, useRef } from "react";
import type { ModelSelectorProps } from "../../types";
import styles from "./ModelSelector.module.css";

// Icons
function ModelIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
			<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
		</svg>
	);
}

function DropdownIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<polyline points="6 9 12 15 18 9" />
		</svg>
	);
}

export function ModelSelector({
	models,
	currentModel,
	isLoading,
	isStreaming,
	onSelect,
}: ModelSelectorProps) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener("click", handleClickOutside);
		return () => document.removeEventListener("click", handleClickOutside);
	}, []);

	const currentModelName = currentModel
		? models.find((m) => m.id === currentModel)?.name || currentModel.split("-")[0]
		: "Select Model";

	const handleSelect = (modelId: string) => {
		onSelect(modelId);
		setIsOpen(false);
	};

	return (
		<div className={styles.container} ref={containerRef}>
			<button
				className={styles.selector}
				onClick={() => setIsOpen(!isOpen)}
				disabled={isStreaming}
				title="Select Model"
			>
				<ModelIcon />
				<span className={styles.text}>{currentModelName}</span>
				<DropdownIcon />
			</button>
			{isOpen && (
				<div className={styles.dropdown}>
					{isLoading ? (
						<div className={styles.loading}>Loading...</div>
					) : (
						models.map((model) => (
							<div
								key={model.id}
								className={`${styles.item} ${model.id === currentModel ? styles.active : ""}`}
								onClick={() => handleSelect(model.id)}
							>
								<span className={styles.name}>{model.name}</span>
								<span className={styles.provider}>{model.provider}</span>
							</div>
						))
					)}
				</div>
			)}
		</div>
	);
}
