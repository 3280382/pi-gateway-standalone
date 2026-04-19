/**
 * FileGrid - Grid view for file browser
 *
 * Responsibilities:纯 UI 渲染
 * - 无业务逻辑
 * - 通过 useFileItemActions 获取所有交互处理器
 */

import { memo } from "react";
import { useFileItemActions } from "@/features/files/hooks";
import type { FileItem as FileItemType } from "@/features/files/stores/fileStore";
import styles from "./FileGrid.module.css";
import { FileItem } from "./FileItem";

interface FileGridProps {
   items: FileItemType[];
}

export const FileGrid = memo<FileGridProps>(({  items }) => {
  // ========== 1. State ==========
  const {
    selectedItems,
    isMultiSelectMode,
    draggingItem,
    dropTarget,
    showPinchHint,
    getItemHandlers,
    getContainerHandlers,
  } = useFileItemActions();

  // ========== 2. Ref ==========
  // 无直接DOM引用

  // ========== 3. Effects ==========
  // 无外部副作用

  // ========== 4. Computed ==========
  const containerHandlers = getContainerHandlers();

  // ========== 5. Actions ==========
  // 通过 useFileItemActions 获取

  // ========== 6. Render ==========
  return (
    <>
      <div className={styles.grid} {...containerHandlers}>
        { items.map((item) => {
          const handlers = getItemHandlers(item);
          return (
            <FileItem
              key={item.path}
              item={item}
              isSelected={selectedItems.includes(item.path)}
              isMultiSelectMode={isMultiSelectMode}
              isDropTarget={dropTarget === item.path}
              isDragging={draggingItem === item.path}
              {...handlers}
              viewMode="grid"
            />
          );
        })}
      </div>

      {showPinchHint && <div className={styles.pinchHint}>Multi-select mode enabled</div>}
    </>
  );
});

FileGrid.displayName = "FileGrid";
