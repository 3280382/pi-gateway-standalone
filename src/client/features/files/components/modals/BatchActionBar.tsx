/**
 * BatchActionBar - 批量操作栏
 * 在多选模式下显示在顶部
 *
 * 职责：UI 渲染
 * - 使用 useFileOperations 处理删除逻辑
 */
import React, { useState } from "react";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useFileOperations } from "@/features/files/hooks";
import styles from "./BatchActionBar.module.css";

export function BatchActionBar() {
	const {
		selectedItems,
		items,
		isMultiSelectMode,
		toggleMultiSelectMode,
		clearSelection,
	} = useFileStore();

	const { deleteSelected } = useFileOperations();

	const [isDeleting, setIsDeleting] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);

	if (!isMultiSelectMode) return null;

	const selectedCount = selectedItems.length;

	// Get selected item names for display
	const selectedNames = selectedItems
		.map((path) => {
			const item = items.find((i) => i.path === path);
			return item?.name || path.split("/").pop() || path;
		})
		.slice(0, 5); // Show max 5 names

	const hasMore = selectedItems.length > 5;

	const handleDeleteClick = () => {
		if (selectedCount === 0) return;
		setShowConfirm(true);
	};

	const handleConfirmDelete = async () => {
		setIsDeleting(true);
		try {
			await deleteSelected();
			setShowConfirm(false);
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
			{showConfirm && (
				<div
					className={styles.modalOverlay}
					onClick={() => !isDeleting && setShowConfirm(false)}
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
								onClick={() => setShowConfirm(false)}
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
