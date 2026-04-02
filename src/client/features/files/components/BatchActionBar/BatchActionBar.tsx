/**
 * BatchActionBar - 批量操作栏
 * 在多选模式下显示在顶部
 */
import React from "react";
import { useFileStore } from "@/stores/fileStore";
import styles from "./BatchActionBar.module.css";

export function BatchActionBar() {
	const {
		selectedItems,
		isMultiSelectMode,
		toggleMultiSelectMode,
		clearSelection,
		deleteSelectedItems,
		currentPath,
	} = useFileStore();

	if (!isMultiSelectMode) return null;

	const selectedCount = selectedItems.length;

	const handleDelete = async () => {
		if (selectedCount === 0) return;
		if (!confirm(`Delete ${selectedCount} selected item(s)?`)) return;
		try {
			await deleteSelectedItems();
		} catch (error) {
			console.error("Delete failed:", error);
		}
	};

	const handleCancel = () => {
		clearSelection();
		toggleMultiSelectMode();
	};

	return (
		<div className={styles.batchBar}>
			<div className={styles.leftSection}>
				<span className={styles.selectedCount}>
					{selectedCount} selected
				</span>
			</div>
			<div className={styles.actions}>
				<button
					className={`${styles.actionBtn} ${styles.deleteBtn}`}
					onClick={handleDelete}
					disabled={selectedCount === 0}
					title="Delete selected"
				>
					<DeleteIcon />
					<span>Delete</span>
				</button>
				<button
					className={styles.actionBtn}
					onClick={handleCancel}
					title="Cancel selection"
				>
					<span>Cancel</span>
				</button>
			</div>
		</div>
	);
}

function DeleteIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
		>
			<polyline points="3 6 5 6 21 6" />
			<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
		</svg>
	);
}
