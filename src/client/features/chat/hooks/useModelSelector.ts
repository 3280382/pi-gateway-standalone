/**
 * useModelSelector - 模型选择器逻辑 Hook
 *
 * 职责：
 * - 管理模型选择器状态
 * - 加载模型列表
 * - 处理模型选择
 */

import { useCallback, useEffect, useState } from "react";

export interface Model {
	id: string;
	name: string;
	provider: string;
}

export interface UseModelSelectorReturn {
	// 状态
	isOpen: boolean;
	models: Model[];
	isLoading: boolean;

	// 操作
	open: () => void;
	close: () => void;
	toggle: () => void;
	selectModel: (modelId: string) => Promise<void>;
	refreshModels: () => Promise<void>;
}

interface UseModelSelectorOptions {
	currentModel: string | null;
	onModelChange: (model: { id: string; provider: string }) => Promise<void>;
}

export function useModelSelector(
	options: UseModelSelectorOptions,
): UseModelSelectorReturn {
	const { currentModel, onModelChange } = options;

	const [isOpen, setIsOpen] = useState(false);
	const [models, setModels] = useState<Model[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	// 加载模型列表
	const refreshModels = useCallback(async () => {
		setIsLoading(true);
		try {
			const response = await fetch("/api/models");
			const data = await response.json();
			setModels(data.models || []);
		} catch (error) {
			console.error("[useModelSelector] Failed to load models:", error);
			setModels([]);
		} finally {
			setIsLoading(false);
		}
	}, []);

	// 打开选择器
	const open = useCallback(() => {
		setIsOpen(true);
		if (models.length === 0 && !isLoading) {
			refreshModels();
		}
	}, [models.length, isLoading, refreshModels]);

	// 关闭选择器
	const close = useCallback(() => {
		setIsOpen(false);
	}, []);

	// 切换选择器
	const toggle = useCallback(() => {
		if (isOpen) {
			close();
		} else {
			open();
		}
	}, [isOpen, open, close]);

	// 选择模型
	const selectModel = useCallback(
		async (modelId: string) => {
			const model = models.find((m) => m.id === modelId);
			if (model) {
				try {
					await onModelChange({ id: model.id, provider: model.provider });
				} catch (error) {
					console.error("[useModelSelector] Failed to set model:", error);
				}
			}
			close();
		},
		[models, onModelChange, close],
	);

	// 当选择器打开时加载模型
	useEffect(() => {
		if (isOpen && models.length === 0 && !isLoading) {
			refreshModels();
		}
	}, [isOpen, models.length, isLoading, refreshModels]);

	return {
		isOpen,
		models,
		isLoading,
		open,
		close,
		toggle,
		selectModel,
		refreshModels,
	};
}
