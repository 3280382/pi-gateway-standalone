/**
 * FileBottomMenu - 文件功能底部菜单
 * 位于 APP Footer 上方，提供新建、删除等功能
 */
import React, { useState, useCallback } from "react";
import { useFileStore } from "@/features/files/stores/fileStore";
import styles from "./FileBottomMenu.module.css";

export function FileBottomMenu() {
	const [showNewModal, setShowNewModal] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [newFileName, setNewFileName] = useState("");

	const {
		selectedItems,
		isMultiSelectMode,
		toggleMultiSelectMode,
		clearSelection,
		deleteSelectedItems,
		currentPath,
		createNewFile,
	} = useFileStore();

	// 新建文件
	const handleNewClick = useCallback(() => {
		setShowNewModal(true);
		setNewFileName("");
	}, []);

	const handleConfirmNew = useCallback(async () => {
		if (!newFileName.trim()) return;
		const fileName = newFileName.trim();
		await createNewFile(fileName);
		setShowNewModal(false);
		setNewFileName("");
	}, [newFileName, createNewFile]);

	const handleCancelNew = useCallback(() => {
		setShowNewModal(false);
		setNewFileName("");
	}, []);

	// 删除文件
	const handleDeleteClick = useCallback(() => {
		if (selectedItems.length === 0) {
			// 如果没有选中任何文件，进入复选模式
			if (!isMultiSelectMode) {
				toggleMultiSelectMode();
			}
			return;
		}
		// 有选中文件，显示删除确认
		setShowDeleteModal(true);
	}, [selectedItems.length, isMultiSelectMode, toggleMultiSelectMode]);

	const handleConfirmDelete = useCallback(async () => {
		await deleteSelectedItems();
		setShowDeleteModal(false);
		clearSelection();
		if (isMultiSelectMode) {
			toggleMultiSelectMode();
		}
	}, [deleteSelectedItems, clearSelection, isMultiSelectMode, toggleMultiSelectMode]);

	const handleCancelDelete = useCallback(() => {
		setShowDeleteModal(false);
	}, []);

	return (
		<>
			<div className={styles.menu}>
			<button className={`${styles.btn} ${styles.newBtn}`} onClick={handleNewClick} title="New File">
				<NewIcon />
			</button>
			<button
				className={`${styles.btn} ${styles.deleteBtn}`}
				onClick={handleDeleteClick}
				disabled={isMultiSelectMode && selectedItems.length === 0}
				title={isMultiSelectMode ? `Delete (${selectedItems.length})` : "Delete"}
			>
				<DeleteIcon />
			</button>
			</div>

			{/* 新建文件对话框 */}
			{showNewModal && (
				<div className={styles.modalOverlay} onClick={handleCancelNew}>
					<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
						<div className={styles.modalTitle}>New File</div>
						<div className={styles.inputRow}>
							<input
								type="text"
								className={styles.input}
								value={newFileName}
								onChange={(e) => setNewFileName(e.target.value)}
								placeholder="Enter file name..."
								autoFocus
								onKeyDown={(e) => {
									if (e.key === "Enter") handleConfirmNew();
									if (e.key === "Escape") handleCancelNew();
								}}
							/>
						</div>
						<div className={styles.modalActions}>
							<button className={`${styles.modalBtn} ${styles.cancelBtn}`} onClick={handleCancelNew}>
								Cancel
							</button>
							<button className={`${styles.modalBtn} ${styles.confirmBtn}`} onClick={handleConfirmNew}>
								OK
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 删除确认对话框 */}
			{showDeleteModal && (
				<div className={styles.modalOverlay} onClick={handleCancelDelete}>
					<div className={styles.deleteModal} onClick={(e) => e.stopPropagation()}>
						<div className={styles.deleteModalTitle}>
							<WarningIcon />
							Confirm Delete
						</div>
						<div className={styles.deleteModalText}>
							Delete {selectedItems.length} item(s)?
						</div>
						<div className={styles.modalActions}>
							<button className={`${styles.modalBtn} ${styles.cancelBtn}`} onClick={handleCancelDelete}>
								Cancel
							</button>
							<button
								className={`${styles.modalBtn} ${styles.confirmBtn}`}
								onClick={handleConfirmDelete}
								style={{ background: "var(--accent-red)" }}
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

function NewIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		</svg>
	);
}

function DeleteIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<polyline points="3 6 5 6 21 6" />
			<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
		</svg>
	);
}

function WarningIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="20" height="20">
			<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
			<line x1="12" y1="9" x2="12" y2="13" />
			<line x1="12" y1="17" x2="12.01" y2="17" />
		</svg>
	);
}
