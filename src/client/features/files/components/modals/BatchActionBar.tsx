/**
 * BatchActionBar - 批量操作栏
 * 在多选模式下显示在顶部
 *
 * 职责：UI 渲染
 * - 使用 useFileOperations 处理删除逻辑
 */

import React, { useState } from "react";
import { useFileOperations } from "@/features/files/hooks";
import { useFileStore } from "@/features/files/stores/fileStore";
import styles from "./BatchActionBar.module.css";

export function BatchActionBar() {
	// ========== 1. State ==========
	// Domain 状态
	const {
		selectedItems,
		items,
		isMultiSelectMode,
		toggleMultiSelectMode,
		clearSelection,
	} = useFileStore();

	// UI 状态
	const [isDeleting, setIsDeleting] = useState(false);
	const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

	const { deleteSelected } = useFileOperations();

	// ========== 2. Ref ==========
	// 无直接DOM引用

	// ========== 3. Effects ==========
	// 无外部副作用

	// ========== 4. Computed ==========
	// 非多选模式不渲染
	if (!isMultiSelectMode) return null;

	const selectedCount = selectedItems.length;

	// 获取选中文件名用于显示
	const selectedNames = selectedItems
		.map((path) => {
			const item = items.find((i) => i.path === path);
			return item?.name || path.split("/").pop() || path;
		})
		.slice(0, 5); // 最多显示5个名称

	const hasMore = selectedItems.length > 5;

	// ========== 5. Actions ==========
	const handleDeleteClick = () => {
		if (selectedCount === 0) return;
		setIsConfirmModalOpen(true);
	};

	const handleConfirmDelete = async () => {
		setIsDeleting(true);
		try {
			await deleteSelected();
			setIsConfirmModalOpen(false);
		} catch (error) {
			console.error("Delete failed:", error);
			alert("Delete failed. Please try again.");
		} finally {
			setIsDeleting(false);
		}
	};

	const handleCancel = () => {
		clearSelection();
		toggleMultiSelectMode();
	};

	// ========== 6. Render ==========
	return (
		<>
			<div className={styles.batchBar}>
				<div className={styles.leftSection}>
					<span className={styles.selectedCount}>{selectedCount} selected</span>
				</div>
				<div className={styles.actions}>
					<button
						className={`${styles.actionBtn} ${styles.deleteBtn}`}
						onClick={handleDeleteClick}
						disabled={selectedCount === 0 || isDeleting}
						title="Delete selected"
					>
						<DeleteIcon />
						<span>{isDeleting ? "Deleting..." : "Delete"}</span>
					</button>
					<button
						className={`${styles.actionBtn} ${styles.cancelBtn}`}
						onClick={handleCancel}
						disabled={isDeleting}
						title="Cancel selection"
					>
						<span>Cancel</span>
					</button>
				</div>
			</div>

			{/* Delete Confirmation Modal */}
			{isConfirmModalOpen && (
				<div
					className={styles.modalOverlay}
					onClick={() => !isDeleting && setIsConfirmModalOpen(false)}
				>
					<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
						<div className={styles.modalHeader}>
							<span className={styles.warningIcon}>⚠️</span>
							<h3>Confirm Delete</h3>
						</div>
						<div className={styles.modalContent}>
							<p className={styles.warningText}>
								Are you sure you want to delete <strong>{selectedCount}</strong>{" "}
								item(s)?
							</p>
							<p className={styles.warningSubtext}>
								This action cannot be undone.
							</p>
							<div className={styles.fileList}>
								{selectedNames.map((name, idx) => (
									<div key={idx} className={styles.fileName}>
										📄 {name}
									</div>
								))}
								{hasMore && (
									<div className={styles.moreFiles}>
										...and {selectedCount - 5} more
									</div>
								)}
							</div>
						</div>
						<div className={styles.modalActions}>
							<button
								className={styles.cancelBtn}
								onClick={() => setIsConfirmModalOpen(false)}
								disabled={isDeleting}
							>
								Cancel
							</button>
							<button
								className={styles.confirmDeleteBtn}
								onClick={handleConfirmDelete}
								disabled={isDeleting}
							>
								{isDeleting ? (
									<>
										<LoadingSpinner />
										Deleting...
									</>
								) : (
									"Yes, Delete"
								)}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
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

function LoadingSpinner() {
	return (
		<svg
			className={styles.spinner}
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
		>
			<circle
				cx="12"
				cy="12"
				r="10"
				strokeDasharray="60"
				strokeLinecap="round"
			/>
		</svg>
	);
}
