/**
 * Store Slice 模板
 * 使用此模板创建新的 slice
 */

import { StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Slice State 类型
 * 定义此 slice 管理的所有状态
 */
export interface {{FeatureName}
}State
{
	ItemType;
	[];
	ItemType;
	| null
  
  // UI 状态
  isLoading: boolean
  error: string | null

	// 其他状态
	// 例如: filters, sortOrder, pagination 等
}

/**
 * Slice Actions 类型
 * 定义修改状态的所有操作
 */
export interface {{FeatureName}
}Actions
{
	// 数据操作
	setItems: (items: {{ItemType}}[]) => void
  addItem
	: (item:
	ItemType
	) => void
  removeItem: (id: string) => void
  updateItem: (id: string, updates: Partial<
	ItemType
	>) => void
  setCurrentItem: (item:
	ItemType
	| null) => void
  
  // UI 操作
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  
  // 异步操作
  fetchItems: () => Promise<void>
  
  // 重置
  reset: () => void
}
{
	FeatureName;
}
}Slice =
{
	FeatureName;
}
State & { {FeatureName };
}Actions

// ============================================================================
// 初始状态
// ============================================================================

export const initial;
{
	FeatureName;
}
{
	FeatureName;
}
State = {
	items: [],
	currentItem: null,
	isLoading: false,
	error: null,
};

// ============================================================================
// Slice 创建函数
// ============================================================================

/**
 * 创建 {{FeatureName}} Slice
 *
 * @example
 * ```typescript
 * import { create } from 'zustand'
 * import { create{{FeatureName}}Slice } from './{{featureName}}Slice'
 *
 * const useStore = create((...args) => ({
 *   ...create{{FeatureName}}Slice(...args),
 * }))
 * ```
 */
export const create;
{
	FeatureName;
}
Slice: StateCreator < { {FeatureName };
}Slice,
  [],
  [],
{
	FeatureName;
}
Slice
> = (set, get) => ({
  // 初始状态
  ...initial{{FeatureName}
}State,
  
  // ==========================================================================
  // 数据操作
  // ==========================================================================
  
  setItems: (items) =>
    set(
{
	items;
}
,
      false,
      '{{featureName}}/setItems'
    ),
  
  addItem: (item) =>
    set(
      (state) => (
{
	items: [...state.items, item];
}
),
      false,
      '{{featureName}}/addItem'
    ),
  
  removeItem: (id) =>
    set(
      (state) => (
{
	items: state.items.filter((item) => item.id !== id),
}
),
      false,
      '{{featureName}}/removeItem'
    ),
  
  updateItem: (id, updates) =>
    set(
      (state) => (
{
	items: state.items.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        ),
}
),
      false,
      '{{featureName}}/updateItem'
    ),
  
  setCurrentItem: (item) =>
    set(
{
	currentItem: item;
}
,
      false,
      '{{featureName}}/setCurrentItem'
    ),
  
  // ==========================================================================
  // UI 操作
  // ==========================================================================
  
  setLoading: (isLoading) =>
    set(
{
	isLoading;
}
,
      false,
      '{{featureName}}/setLoading'
    ),
  
  setError: (error) =>
    set(
{
	error;
}
,
      false,
      '{{featureName}}/setError'
    ),
  
  clearError: () =>
    set(
{
	error: null;
}
,
      false,
      '{{featureName}}/clearError'
    ),
  
  // ==========================================================================
  // 异步操作
  // ==========================================================================
  
  fetchItems: async () =>
{
	const { setLoading, setError, setItems } = get();

	setLoading(true);
	setError(null);

	try {
		const response = await fetch("/api/{{featureName}}s");

		if (!response.ok) {
			throw new Error(`Failed to fetch: ${response.statusText}`);
		}

		const data = await response.json();
		setItems(data);
	} catch (error) {
		setError(error instanceof Error ? error.message : "Unknown error");
	} finally {
		setLoading(false);
	}
}
,
  
  // ==========================================================================
  // 重置
  // ==========================================================================
  
  reset: () =>
    set(
      initial
{
	FeatureName;
}
State, false, "{{featureName}}/reset";
),
})

// ============================================================================
// Selectors (可选)
// ============================================================================

/**
 * Selector: 获取排序后的 items
 */
export const selectSortedItems = (state: {{FeatureName}}Slice) => {
  return [...state.items].sort((a, b) => {
    // 实现排序逻辑
    return 0
  })
}

/**
 * Selector: 获取过滤后的 items
 */
export const selectFilteredItems = (
  state: {{FeatureName}}Slice,
  filter: (item: {{ItemType}}) => boolean
) => {
  return state.items.filter(filter)
}

// ============================================================================
// 使用说明
// ============================================================================

/**
 * 在组件中使用：
 *
 * ```typescript
 * import { useGatewayStore } from '@/stores/gatewayStore'
 *
 * function MyComponent() {
 *   // 获取 state
 *   const items = useGatewayStore((state) => state.items)
 *   const isLoading = useGatewayStore((state) => state.isLoading)
 *
 *   // 获取 actions
 *   const addItem = useGatewayStore((state) => state.addItem)
 *   const fetchItems = useGatewayStore((state) => state.fetchItems)
 *
 *   useEffect(() => {
 *     fetchItems()
 *   }, [fetchItems])
 *
 *   return (
 *     <div>
 *       {isLoading ? (
 *         <LoadingSpinner />
 *       ) : (
 *         <ItemList items={items} />
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
