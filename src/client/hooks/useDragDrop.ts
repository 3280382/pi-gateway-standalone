/**
 * useDragDrop - 拖拽功能 Hook
 * 封装 HTML5 Drag and Drop API
 */
import { useCallback, useState, useRef } from 'react';

export interface DragItem {
  id: string;
  type: string;
  data: unknown;
}

export interface UseDragDropOptions<T> {
  onDragStart?: (item: T) => void;
  onDragEnd?: () => void;
  onDragOver?: (item: T, targetId: string) => void;
  onDrop?: (item: T, targetId: string) => void;
  onDragLeave?: () => void;
}

export interface DragDropState {
  isDragging: boolean;
  draggedId: string | null;
  dropTargetId: string | null;
}

export function useDragDrop<T extends { id: string }>(options: UseDragDropOptions<T> = {}) {
  const { onDragStart, onDragEnd, onDragOver, onDrop, onDragLeave } = options;
  
  const [state, setState] = useState<DragDropState>({
    isDragging: false,
    draggedId: null,
    dropTargetId: null,
  });

  const draggedItemRef = useRef<T | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, item: T) => {
    draggedItemRef.current = item;
    setState(prev => ({ ...prev, isDragging: true, draggedId: item.id }));
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
    
    // 设置拖拽时的视觉效果
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
    
    onDragStart?.(item);
  }, [onDragStart]);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    // 恢复视觉效果
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '';
    }
    
    draggedItemRef.current = null;
    setState({
      isDragging: false,
      draggedId: null,
      dropTargetId: null,
    });
    
    onDragEnd?.();
  }, [onDragEnd]);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string, canDrop: boolean = true) => {
    if (!canDrop) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    setState(prev => ({ ...prev, dropTargetId: targetId }));
    
    if (draggedItemRef.current) {
      onDragOver?.(draggedItemRef.current, targetId);
    }
  }, [onDragOver]);

  const handleDragLeave = useCallback(() => {
    setState(prev => ({ ...prev, dropTargetId: null }));
    onDragLeave?.();
  }, [onDragLeave]);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    
    const draggedId = e.dataTransfer.getData('text/plain');
    
    setState({
      isDragging: false,
      draggedId: null,
      dropTargetId: null,
    });
    
    if (draggedItemRef.current && draggedId !== targetId) {
      onDrop?.(draggedItemRef.current, targetId);
    }
    
    draggedItemRef.current = null;
  }, [onDrop]);

  const isDragged = useCallback((id: string) => {
    return state.draggedId === id;
  }, [state.draggedId]);

  const isDropTarget = useCallback((id: string) => {
    return state.dropTargetId === id;
  }, [state.dropTargetId]);

  return {
    state,
    handlers: {
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
    isDragged,
    isDropTarget,
  };
}
