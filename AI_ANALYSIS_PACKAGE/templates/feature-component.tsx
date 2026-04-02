/**
 * Feature Component 模板
 * 使用此模板创建新的 Feature 组件
 */

import React, { useCallback, useEffect, useMemo } from "react";
import { useGatewayStore } from "@/stores/gatewayStore";
import styles from "./{{ComponentName}}.module.css";

// ============================================================================
// 类型定义
// ============================================================================

export interface {{ComponentName}
}Props
{
	/** 组件标题 */
	title?: string

	/** 初始数据 */
	initialData?: {{DataType}
}
[];

/** 数据变化回调 */
onDataChange?: (data: {{DataType}}[]) => void
  
  /** 自定义类名 */
  className?: string
}

// ============================================================================
// 组件
// ============================================================================

/**
 * {{ComponentName}} 组件
 *
 * @description
 * 这是一个 Feature 组件模板，用于展示 {{FeatureDescription}}。
 *
 * @example
 * ```tsx
 * <{{ComponentName}}
 *   title="My Title"
 *   initialData={[]}
 *   onDataChange={(data) => console.log(data)}
 * />
 * ```
 *
 * @ai-notes
 * 修改此组件时需要注意：
 * 1. 使用细粒度的 selectors 避免不必要的重渲染
 * 2. 异步操作使用 try-catch 处理错误
 * 3. 清理副作用（useEffect 返回 cleanup 函数）
 */
export const { {ComponentName };
}: React.FC<
{
	ComponentName;
}
Props> = ({
	title = "Default Title",
	initialData,
	onDataChange,
	className,
}) => {
	// ==========================================================================
	// Store Selectors (细粒度选择)
	// ==========================================================================

	const items = useGatewayStore((state) => state.items);
	const isLoading = useGatewayStore((state) => state.isLoading);
	const error = useGatewayStore((state) => state.error);

	const setItems = useGatewayStore((state) => state.setItems);
	const addItem = useGatewayStore((state) => state.addItem);
	const removeItem = useGatewayStore((state) => state.removeItem);
	const fetchItems = useGatewayStore((state) => state.fetchItems);

	// ==========================================================================
	// 计算属性 (useMemo)
	// ==========================================================================

	const sortedItems = useMemo(() => {
		return [...items].sort((a, b) => {
			// 实现排序逻辑
			return a.createdAt - b.createdAt;
		});
	}, [items]);

	const itemCount = useMemo(() => items.length, [items]);

	// ==========================================================================
	// 副作用 (useEffect)
	// ==========================================================================

	// 初始化数据
	useEffect(() => {
		if (initialData) {
			setItems(initialData);
		} else {
			fetchItems();
		}
	}, [initialData, setItems, fetchItems]);

	// 数据变化通知
	useEffect(() => {
		onDataChange?.(items);
	}, [items, onDataChange]);

	// ==========================================================================
	// 事件处理 (useCallback)
	// ==========================================================================

	const handleAddItem = useCallback((item: {{DataType}}) => {
    addItem(item)
  }, [addItem])

	const handleRemoveItem = useCallback(
		(id: string) => {
			removeItem(id);
		},
		[removeItem],
	);

	const handleRefresh = useCallback(() => {
		fetchItems();
	}, [fetchItems]);

	// ==========================================================================
	// 渲染
	// ==========================================================================

	if (isLoading) {
		return (
			<div className={`${styles.container} ${className || ""}`}>
				<div className={styles.loading}>
					<Spinner />
					<span>Loading...</span>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className={`${styles.container} ${className || ""}`}>
				<div className={styles.error}>
					<ErrorIcon />
					<span>{error}</span>
					<button onClick={handleRefresh}>Retry</button>
				</div>
			</div>
		);
	}

	return (
		<div className={`${styles.container} ${className || ""}`}>
			{/* 标题栏 */}
			<header className={styles.header}>
				<h2 className={styles.title}>{title}</h2>
				<span className={styles.count}>({itemCount})</span>
				<button
					className={styles.refreshBtn}
					onClick={handleRefresh}
					title="Refresh"
				>
					<RefreshIcon />
				</button>
			</header>

			{/* 列表 */}
			<ul className={styles.list}>
				{sortedItems.map((item) => (
					<li key={item.id} className={styles.item}>
						<ItemCard data={item} onRemove={() => handleRemoveItem(item.id)} />
					</li>
				))}
			</ul>

			{/* 空状态 */}
			{items.length === 0 && (
				<div className={styles.empty}>
					<EmptyIcon />
					<p>No items found</p>
				</div>
			)}
		</div>
	);
};

// ============================================================================
// 子组件
// ============================================================================

interface ItemCardProps {
	data: {{DataType}
}
onRemove: () => void
}

const ItemCard: React.FC<ItemCardProps> = React.memo(({ data, onRemove }) => {
	return (
		<div className={styles.card}>
			<div className={styles.cardContent}>
				<h3 className={styles.cardTitle}>{data.title}</h3>
				<p className={styles.cardDescription}>{data.description}</p>
			</div>
			<button
				className={styles.cardRemoveBtn}
				onClick={onRemove}
				title="Remove"
			>
				<RemoveIcon />
			</button>
		</div>
	);
});

// ============================================================================
// 图标组件 (简化版)
// ============================================================================

const Spinner = () => <span className={styles.spinner}>⟳</span>;
const ErrorIcon = () => <span className={styles.errorIcon}>⚠</span>;
const RefreshIcon = () => <span>↻</span>;
const EmptyIcon = () => <span>📭</span>;
const RemoveIcon = () => <span>✕</span>;

// ============================================================================
// 样式说明 ({{ComponentName}}.module.css)
// ============================================================================

/*
.container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--bg-primary);
  border-radius: var(--radius-md);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.title {
  font-size: var(--font-lg);
  font-weight: 600;
}

.count {
  color: var(--text-muted);
  font-size: var(--font-sm);
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  list-style: none;
  padding: 0;
  margin: 0;
}

.item {
  display: flex;
}

.card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  width: 100%;
}

.loading,
.error,
.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xl);
  color: var(--text-muted);
}

.error {
  color: var(--text-error);
}
*/
