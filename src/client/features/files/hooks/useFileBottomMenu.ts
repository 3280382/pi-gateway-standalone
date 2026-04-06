/**
 * useFileBottomMenu - 文件底部菜单业务逻辑 Hook
 *
 * 职责：管理底部菜单的所有业务逻辑
 * - 新建文件
 * - 删除文件
 * - 树状视图
 */

import { useCallback, useEffect, useState } from "react";
import { getFileTree, type TreeResponse } from "@/features/files/services/api/fileApi";
import { useFileStore } from "@/features/files/stores/fileStore";
import { useFileViewerStore } from "@/features/files/stores/fileViewerStore";
import { useFileOperations } from "./useFileOperations";

export interface UseFileBottomMenuResult {
	// UI 状态
	showNewModal: boolean;
	showDeleteModal: boolean;
	showTreeModal: boolean;
	newFileName: string;
	treeData: TreeResponse | null;
	treeLoading: boolean;

	// 状态设置
	setNewFileName: (name: string) => void;
	setShowNewModal: (show: boolean) => void;
	setShowDeleteModal: (show: boolean) => void;
	setShowTreeModal: (show: boolean) => void;

	// 操作方法
	handleNewClick: () => void;
	handleConfirmNew: () => Promise<void>;
	handleCancelNew: () => void;
	handleDeleteClick: () => void;
	handleConfirmDelete: () => Promise<void>;
	handleCancelDelete: () => void;
	handleTreeClick: () => Promise<void>;
	handleTreeFileClick: (filePath: string, fileName: string) => void;
	handleCloseTree: () => void;
}

export function useFileBottomMenu(): UseFileBottomMenuResult {
	const [showNewModal, setShowNewModal] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [showTreeModal, setShowTreeModal] = useState(false);
	const [newFileName, setNewFileName] = useState("");
	const [treeData, setTreeData] = useState<TreeResponse | null>(null);
	const [treeLoading, setTreeLoading] = useState(false);

	const {
		selectedItems,
		isMultiSelectMode,
		toggleMultiSelectMode,
		clearSelection,
		currentPath,
	} = useFileStore();

	const { createNewFile, deleteSelected } = useFileOperations();
	const { openViewer } = useFileViewerStore();

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
			if (!isMultiSelectMode) {
				toggleMultiSelectMode();
			}
			return;
		}
		setShowDeleteModal(true);
	}, [selectedItems.length, isMultiSelectMode, toggleMultiSelectMode]);

	const handleConfirmDelete = useCallback(async () => {
		await deleteSelected();
		setShowDeleteModal(false);
		clearSelection();
		if (isMultiSelectMode) {
			toggleMultiSelectMode();
		}
	}, [deleteSelected, clearSelection, isMultiSelectMode, toggleMultiSelectMode]);

	const handleCancelDelete = useCallback(() => {
		setShowDeleteModal(false);
	}, []);

	// 树状视图
	const handleTreeClick = useCallback(async () => {
		setShowTreeModal(true);
		setTreeLoading(true);
		try {
			const data = await getFileTree(currentPath);
			setTreeData(data);
		} catch (error) {
			console.error("[TreeView] Failed to load file tree:", error);
		} finally {
			setTreeLoading(false);
		}
	}, [currentPath]);

	const handleTreeFileClick = useCallback(
		(filePath: string, fileName: string) => {
			const fullPath = currentPath ? `${currentPath}/${filePath}` : filePath;
			openViewer(fullPath, fileName, "view");
		},
		[currentPath, openViewer],
	);

	const handleCloseTree = useCallback(() => {
		setShowTreeModal(false);
		setTreeData(null);
	}, []);

	// ESC 关闭树状视图
	useEffect(() => {
		if (!showTreeModal) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") handleCloseTree();
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [showTreeModal, handleCloseTree]);

	return {
		showNewModal,
		showDeleteModal,
		showTreeModal,
		newFileName,
		treeData,
		treeLoading,
		setNewFileName,
		setShowNewModal,
		setShowDeleteModal,
		setShowTreeModal,
		handleNewClick,
		handleConfirmNew,
		handleCancelNew,
		handleDeleteClick,
		handleConfirmDelete,
		handleCancelDelete,
		handleTreeClick,
		handleTreeFileClick,
		handleCloseTree,
	};
}
