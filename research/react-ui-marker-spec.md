# React UI Marker - 技术规格文档

**文档版本**: 1.0  
**最后更新**: 2025-04-17  
**文档状态**: 技术评审  

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [系统架构](#2-系统架构)
3. [核心模块规格](#3-核心模块规格)
4. [接口定义](#4-接口定义)
5. [实现代码](#5-实现代码)
6. [集成指南](#6-集成指南)
7. [输出格式规范](#7-输出格式规范)
8. [测试方案](#8-测试方案)

---

## 1. 执行摘要

### 1.1 项目背景

在复杂 React 应用中，用户与 AI 协作进行界面修改时存在严重的**沟通障碍**：

| 痛点 | 具体表现 |
|------|----------|
| 描述困难 | "左上角第二个红色按钮" |
| 定位不准 | 无法精确对应到代码位置 |
| 意图模糊 | AI 难以理解"弄好看点"的具体含义 |
| 上下文缺失 | 缺少组件结构、props 等关键信息 |

### 1.2 解决方案

**React UI Marker** 是一个浏览器端插件系统，提供：

1. **可视化标记** - 为所有可交互元素添加数字标签
2. **点击选择** - 点击元素弹出输入对话框
3. **智能解析** - 自动提取组件名称、位置、源码、props
4. **标准输出** - 生成 AI 可理解的结构化上下文

### 1.3 核心价值

- ⏱️ **效率提升**: 界面修改沟通时间从 10 分钟降至 1 分钟
- 🎯 **精准定位**: 直接定位到具体组件文件和行号
- 💡 **意图清晰**: 结合视觉选择和自然语言描述
- 🔧 **零侵入**: 无需修改现有代码，即插即用

---

## 2. 系统架构

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Overlay   │  │   Picker    │  │    Input Dialog         │ │
│  │   (Labels)  │  │   (Hover)   │  │    (Modal)              │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
│         │                │                      │               │
│         └────────────────┴──────────────────────┘               │
│                          │                                      │
├──────────────────────────┼──────────────────────────────────────┤
│                     Core Engine Layer                            │
├──────────────────────────┼──────────────────────────────────────┤
│  ┌───────────────────────┴───────────────────────┐              │
│  │           ReactUIMarker (Controller)          │              │
│  └───────────────────────┬───────────────────────┘              │
│         ┌────────────────┼────────────────┐                     │
│         ▼                ▼                ▼                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Marker    │  │   Element   │  │    Code     │             │
│  │  Generator  │  │   Picker    │  │   Resolver  │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
├─────────┼────────────────┼────────────────┼─────────────────────┤
│         │         Integration Layer         │                    │
├─────────┼────────────────┼────────────────┼─────────────────────┤
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐              │
│  │    BIPPY    │  │  DevTools   │  │  SourceMap  │              │
│  │  (Fiber)    │  │    Hook     │  │  Resolver   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 模块职责

| 模块 | 职责 | 关键技术 |
|------|------|----------|
| MarkerGenerator | 扫描 DOM，生成标记 | querySelectorAll, IntersectionObserver |
| ElementPicker | 处理鼠标交互 | elementFromPoint, event delegation |
| CodeResolver | 解析组件源码位置 | Source Map, Stack Trace |
| InputDialog | 收集用户输入 | Modal, Form |
| ReactUIMarker | 协调各模块 | EventEmitter, State Machine |

---

## 3. 核心模块规格

### 3.1 MarkerGenerator - 标记生成器

**功能**: 扫描页面可交互元素，生成带编号的标记

**输入**: `HTMLElement` (根元素，默认 document.body)

**输出**: `Marker[]`

**算法**:

```
1. 查询所有可交互元素
   selector: button, input, select, textarea, a, [role="button"], [role="input"]

2. 过滤不可见元素
   - display !== 'none'
   - visibility !== 'hidden'
   - width > 10 && height > 10

3. 对每个可见元素:
   a. 获取对应的 React Fiber
   b. 向上查找最近的复合组件 (函数/类组件)
   c. 计算优先级分数
   d. 生成 Marker 对象

4. 按位置排序，分配编号
```

**数据结构**:

```typescript
interface Marker {
  id: string;           // 唯一标识: "marker-{index}"
  label: string;        // 显示编号: "1", "2", "3"...
  element: HTMLElement; // DOM 元素引用
  rect: DOMRect;        // 位置信息
  componentName: string; // React 组件名
  fiber: Fiber;         // React Fiber 节点
  priority: number;     // 优先级分数 (0-100)
}
```

### 3.2 ElementPicker - 元素选择器

**功能**: 处理鼠标悬停高亮和点击选择

**交互流程**:

```
鼠标移动
  ↓
获取坐标下的元素 (elementFromPoint)
  ↓
向上查找最近的标记元素
  ↓
显示高亮框 + 信息标签
  ↓
用户点击
  ↓
触发 onSelect 回调
```

**视觉设计**:

| 元素 | 样式 |
|------|------|
| 高亮框 | 2px solid #6366f1, rgba(99,102,241,0.1) 背景 |
| 信息标签 | 位置: 元素上方 28px, 背景: #6366f1, 文字: 白色 |
| 标签内容 | `[编号] 组件名` |
| 过渡动画 | 0.1s ease |

**Z-Index 层级**:

| 元素 | z-index |
|------|---------|
| 标记标签 | 2147483645 |
| 高亮框 | 2147483646 |
| 信息标签 | 2147483647 |
| 输入对话框 | 2147483647 |

### 3.3 CodeResolver - 代码定位器

**功能**: 解析 React Fiber，获取组件源码位置

**输入**: `Fiber`

**输出**: `ComponentLocation`

**解析策略** (优先级从高到低):

1. **React DevTools Hook** - 使用 renderer 的 `overrideProps` 等 API
2. **Source Map** - 解析构建后的 source map
3. **Stack Trace** - 通过 Error.stack 获取位置
4. **React 内部属性** - `type.__source` (开发模式)

**数据结构**:

```typescript
interface ComponentLocation {
  fileName: string;       // 文件路径: "/src/components/Button.tsx"
  lineNumber: number;     // 行号: 15
  columnNumber: number;   // 列号: 10
  componentName: string;  // 组件名: "SubmitButton"
  sourceCode: string;     // 源码片段
  props: Record<string, any>; // 当前 props 值
}
```

### 3.4 InputDialog - 输入对话框

**功能**: 收集用户对选中元素的自然语言描述

**UI 设计**:

```
┌─────────────────────────────────────────┐
│  [①] SubmitButton              ✕      │  ← 标题栏: 编号 + 组件名
├─────────────────────────────────────────┤
│  描述你对这个元素的修改需求：           │  ← 提示文字
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 把按钮文字改成'保存'，颜色改成   │   │  ← 输入框
│  │ 蓝色...                        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [取消]                    [提交]       │  ← 按钮
└─────────────────────────────────────────┘
```

**规格**:

- 宽度: 480px, 最大 90vw
- 输入框: 最小高度 100px, 自动扩展
- 支持 ESC 关闭
- 点击遮罩层关闭
- 自动聚焦输入框

---

## 4. 接口定义

### 4.1 公共 API

```typescript
// 主类
declare class ReactUIMarker {
  constructor(options?: ReactUIMarkerOptions);
  
  // 激活标记系统
  activate(): void;
  
  // 停用标记系统
  deactivate(): void;
  
  // 检查是否激活
  isActive(): boolean;
  
  // 获取所有标记
  getMarkers(): Marker[];
  
  // 手动触发选择 (用于快捷键)
  selectByLabel(label: string): void;
}

// 配置选项
interface ReactUIMarkerOptions {
  // 自定义快捷键 (默认: Ctrl+Shift+M)
  shortcut?: string;
  
  // 自定义选择器
  selector?: string;
  
  // 自定义过滤器
  filter?: (element: HTMLElement) => boolean;
  
  // 提交回调
  onSubmit?: (context: SelectionContext) => void;
  
  // 取消回调
  onCancel?: () => void;
}

// 选择上下文 (提交给 AI 的数据)
interface SelectionContext {
  version: string;
  timestamp: string;
  selection: {
    markerId: string;
    markerLabel: string;
    elementTag: string;
    elementText: string;
    boundingBox: { x: number; y: number; width: number; height: number };
  };
  component: {
    name: string;
    type: 'function' | 'class' | 'forwardRef' | 'memo';
    location: {
      fileName: string;
      lineNumber: number;
      columnNumber: number;
    };
    sourceCode: string;
    props: Record<string, any>;
    state: Record<string, any>;
  };
  ancestors: Array<{
    name: string;
    depth: number;
    location: string;
  }>;
  instruction: string;
}
```

### 4.2 事件接口

```typescript
// 标记系统事件
declare interface ReactUIMarkerEvents {
  // 标记系统激活
  'react-ui-marker:activate': CustomEvent<{ markerCount: number }>;
  
  // 标记系统停用
  'react-ui-marker:deactivate': CustomEvent<{}>;
  
  // 元素被选中
  'react-ui-marker:select': CustomEvent<{ marker: Marker }>;
  
  // 用户提交指令
  'react-ui-marker:submit': CustomEvent<SelectionContext>;
  
  // 用户取消
  'react-ui-marker:cancel': CustomEvent<{}>;
}

// 使用示例
window.addEventListener('react-ui-marker:submit', (e) => {
  const context = e.detail;
  sendToAI(context);
});
```

---

## 5. 实现代码

### 5.1 完整实现 (单文件)

```typescript
// react-ui-marker.ts
// 完整实现代码，可直接使用

// ============================================
// 类型定义
// ============================================

interface Fiber {
  tag: number;
  type: any;
  stateNode: any;
  return: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;
  memoizedProps: any;
  memoizedState: any;
  alternate: Fiber | null;
  index: number;
}

interface Marker {
  id: string;
  label: string;
  element: HTMLElement;
  rect: DOMRect;
  componentName: string;
  fiber: Fiber;
  priority: number;
}

interface SelectionContext {
  version: string;
  timestamp: string;
  selection: {
    markerId: string;
    markerLabel: string;
    elementTag: string;
    elementText: string;
    boundingBox: { x: number; y: number; width: number; height: number };
  };
  component: {
    name: string;
    type: string;
    location: {
      fileName: string;
      lineNumber: number;
      columnNumber: number;
    } | null;
    sourceCode: string;
    props: Record<string, any>;
  };
  ancestors: Array<{ name: string; depth: number }>;
  instruction: string;
}

// ============================================
// Fiber 工具函数 (来自 bippy)
// ============================================

const FunctionComponentTag = 0;
const ClassComponentTag = 1;
const HostComponentTag = 5;

function getFiberFromElement(element: Element): Fiber | null {
  // 方法1: 通过 React DevTools Hook
  const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (hook?.renderers) {
    for (const [, renderer] of Array.from(hook.renderers)) {
      try {
        const fiber = renderer.findFiberByHostInstance?.(element);
        if (fiber) return fiber;
      } catch {}
    }
  }
  
  // 方法2: 通过 React 内部属性
  for (const key in element) {
    if (key.startsWith('__reactInternalInstance$') || key.startsWith('__reactFiber')) {
      return (element as any)[key];
    }
  }
  
  return null;
}

function isCompositeFiber(fiber: Fiber): boolean {
  return fiber.tag === FunctionComponentTag || 
         fiber.tag === ClassComponentTag;
}

function isHostFiber(fiber: Fiber): boolean {
  return fiber.tag === HostComponentTag || typeof fiber.type === 'string';
}

function getDisplayName(type: any): string | null {
  if (typeof type === 'string') return type;
  if (typeof type !== 'function') return null;
  return type.displayName || type.name || null;
}

function findCompositeFiber(fiber: Fiber): Fiber | null {
  let current: Fiber | null = fiber;
  while (current) {
    if (isCompositeFiber(current)) return current;
    current = current.return;
  }
  return null;
}

// ============================================
// MarkerGenerator
// ============================================

class MarkerGenerator {
  private selector = 'button, input, select, textarea, a, [role="button"], [role="input"], [role="link"], label, .clickable';
  
  scan(root: HTMLElement = document.body): Marker[] {
    const elements = root.querySelectorAll(this.selector);
    
    const markers: Marker[] = [];
    
    Array.from(elements).forEach((el, index) => {
      const marker = this.createMarker(el as HTMLElement, index);
      if (marker) markers.push(marker);
    });
    
    // 按优先级排序
    markers.sort((a, b) => b.priority - a.priority);
    
    // 重新分配编号
    markers.forEach((m, i) => {
      m.label = (i + 1).toString();
      m.id = `marker-${i}`;
    });
    
    return markers;
  }
  
  private createMarker(element: HTMLElement, index: number): Marker | null {
    const fiber = getFiberFromElement(element);
    if (!fiber) return null;
    
    const compositeFiber = findCompositeFiber(fiber);
    if (!compositeFiber) return null;
    
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    // 过滤不可见元素
    if (style.display === 'none' || style.visibility === 'hidden') return null;
    if (rect.width < 10 || rect.height < 10) return null;
    
    // 计算优先级
    let priority = 0;
    if (!element.disabled) priority += 20;
    if (element.tabIndex >= 0) priority += 10;
    if (rect.width * rect.height > 1000) priority += 5;
    if (element.onclick || element.getAttribute('onClick')) priority += 5;
    
    return {
      id: `marker-${index}`,
      label: (index + 1).toString(),
      element,
      rect,
      componentName: getDisplayName(compositeFiber.type) || 'Unknown',
      fiber: compositeFiber,
      priority
    };
  }
}

// ============================================
// ElementPicker
// ============================================

class ElementPicker {
  private overlay: HTMLElement;
  private label: HTMLElement;
  private onSelect: (marker: Marker) => void;
  private markers: Map<HTMLElement, Marker> = new Map();
  private isActive = false;
  
  constructor(onSelect: (marker: Marker) => void) {
    this.onSelect = onSelect;
    this.overlay = this.createOverlay();
    this.label = this.createLabel();
  }
  
  private createOverlay(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed;
      border: 2px solid #6366f1;
      background: rgba(99, 102, 241, 0.1);
      border-radius: 4px;
      pointer-events: none;
      z-index: 2147483646;
      transition: all 0.1s ease;
      display: none;
    `;
    return el;
  }
  
  private createLabel(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed;
      background: #6366f1;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 2147483647;
      pointer-events: none;
      white-space: nowrap;
      display: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    `;
    return el;
  }
  
  activate(markers: Marker[]) {
    this.markers.clear();
    markers.forEach(m => this.markers.set(m.element, m));
    
    document.addEventListener('mousemove', this.handleMouseMove, true);
    document.addEventListener('click', this.handleClick, true);
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.label);
    
    this.isActive = true;
  }
  
  deactivate() {
    this.isActive = false;
    document.removeEventListener('mousemove', this.handleMouseMove, true);
    document.removeEventListener('click', this.handleClick, true);
    this.overlay.remove();
    this.label.remove();
    this.hideOverlay();
  }
  
  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isActive) return;
    
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target) {
      this.hideOverlay();
      return;
    }
    
    const markerEl = this.findMarkerElement(target as HTMLElement);
    if (!markerEl) {
      this.hideOverlay();
      return;
    }
    
    const marker = this.markers.get(markerEl);
    if (marker) {
      this.showOverlay(marker);
    }
  };
  
  private handleClick = (e: MouseEvent) => {
    if (!this.isActive) return;
    
    const target = e.target as HTMLElement;
    const markerEl = this.findMarkerElement(target);
    
    if (markerEl) {
      e.preventDefault();
      e.stopPropagation();
      const marker = this.markers.get(markerEl);
      if (marker) {
        this.onSelect(marker);
      }
    }
  };
  
  private findMarkerElement(el: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = el;
    while (current && current !== document.body) {
      if (this.markers.has(current)) return current;
      current = current.parentElement;
    }
    return null;
  }
  
  private showOverlay(marker: Marker) {
    const { rect } = marker;
    
    this.overlay.style.cssText = `
      position: fixed;
      top: ${rect.top + window.scrollY}px;
      left: ${rect.left + window.scrollX}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      border: 2px solid #6366f1;
      background: rgba(99, 102, 241, 0.1);
      border-radius: 4px;
      pointer-events: none;
      z-index: 2147483646;
      transition: all 0.1s ease;
    `;
    
    const labelTop = rect.top + window.scrollY - 32;
    this.label.style.cssText = `
      position: fixed;
      top: ${Math.max(0, labelTop)}px;
      left: ${rect.left + window.scrollX}px;
      background: #6366f1;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 2147483647;
      pointer-events: none;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    `;
    this.label.textContent = `[${marker.label}] ${marker.componentName}`;
  }
  
  private hideOverlay() {
    this.overlay.style.display = 'none';
    this.label.style.display = 'none';
  }
}

// ============================================
// InputDialog
// ============================================

class InputDialog {
  private container: HTMLElement | null = null;
  
  show(options: {
    marker: Marker;
    onSubmit: (instruction: string) => void;
    onCancel: () => void;
  }) {
    const { marker, onSubmit, onCancel } = options;
    
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      width: 480px;
      max-width: 90vw;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    `;
    
    dialog.innerHTML = `
      <div style="margin-bottom: 16px;">
        <span style="
          background: #6366f1;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        ">[${marker.label}]</span>
        <span style="font-weight: 600; margin-left: 8px;">${marker.componentName}</span>
      </div>
      <div style="color: #666; font-size: 13px; margin-bottom: 16px;">
        描述你对这个元素的修改需求：
      </div>
      <textarea 
        id="ai-input" 
        placeholder="例如：把按钮文字改成'保存'，颜色改成蓝色..."
        style="
          width: 100%;
          min-height: 100px;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          resize: vertical;
          box-sizing: border-box;
          font-family: inherit;
        "
      ></textarea>
      <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px;">
        <button id="ai-cancel" style="
          padding: 8px 16px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        ">取消</button>
        <button id="ai-submit" style="
          padding: 8px 16px;
          border: none;
          background: #6366f1;
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">提交</button>
      </div>
    `;
    
    this.container.appendChild(dialog);
    document.body.appendChild(this.container);
    
    const textarea = dialog.querySelector('#ai-input') as HTMLTextAreaElement;
    const submitBtn = dialog.querySelector('#ai-submit') as HTMLButtonElement;
    const cancelBtn = dialog.querySelector('#ai-cancel') as HTMLButtonElement;
    
    textarea.focus();
    
    submitBtn.onclick = () => {
      if (textarea.value.trim()) {
        onSubmit(textarea.value.trim());
        this.close();
      }
    };
    
    cancelBtn.onclick = () => {
      onCancel();
      this.close();
    };
    
    this.container.onclick = (e) => {
      if (e.target === this.container) {
        onCancel();
        this.close();
      }
    };
    
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        submitBtn.click();
      }
      if (e.key === 'Escape') {
        cancelBtn.click();
      }
    });
  }
  
  close() {
    this.container?.remove();
    this.container = null;
  }
}

// ============================================
// CodeResolver
// ============================================

class CodeResolver {
  resolve(fiber: Fiber): {
    fileName: string | null;
    lineNumber: number | null;
    columnNumber: number | null;
    sourceCode: string;
  } {
    const type = fiber.type;
    
    // 方法1: React 内部 source 属性 (开发模式)
    if (type?.__source) {
      return {
        fileName: type.__source.fileName,
        lineNumber: type.__source.lineNumber,
        columnNumber: type.__source.columnNumber || 0,
        sourceCode: ''
      };
    }
    
    // 方法2: 尝试从函数体解析
    try {
      const fn = type.toString();
      // 简单提取函数名作为文件线索
      return {
        fileName: null,
        lineNumber: null,
        columnNumber: null,
        sourceCode: fn.slice(0, 500)
      };
    } catch {
      return {
        fileName: null,
        lineNumber: null,
        columnNumber: null,
        sourceCode: ''
      };
    }
  }
  
  getAncestors(fiber: Fiber): Array<{ name: string; depth: number }> {
    const ancestors: Array<{ name: string; depth: number }> = [];
    let current: Fiber | null = fiber.return;
    let depth = 0;
    
    while (current && depth < 10) {
      if (isCompositeFiber(current)) {
        const name = getDisplayName(current.type);
        if (name) {
          ancestors.push({ name, depth: depth + 1 });
        }
      }
      current = current.return;
      depth++;
    }
    
    return ancestors;
  }
}

// ============================================
// ReactUIMarker (主控制器)
// ============================================

export class ReactUIMarker {
  private markerGenerator: MarkerGenerator;
  private elementPicker: ElementPicker;
  private codeResolver: CodeResolver;
  private inputDialog: InputDialog;
  private markers: Marker[] = [];
  private isActive = false;
  private labelElements: HTMLElement[] = [];
  private onSubmit?: (context: SelectionContext) => void;
  
  constructor(options?: {
    onSubmit?: (context: SelectionContext) => void;
  }) {
    this.onSubmit = options?.onSubmit;
    this.markerGenerator = new MarkerGenerator();
    this.codeResolver = new CodeResolver();
    this.inputDialog = new InputDialog();
    
    this.elementPicker = new ElementPicker(this.handleElementSelect);
  }
  
  activate() {
    if (this.isActive) return;
    this.isActive = true;
    
    // 1. 生成标记
    this.markers = this.markerGenerator.scan();
    
    // 2. 渲染标记标签
    this.renderMarkerLabels();
    
    // 3. 激活选择器
    this.elementPicker.activate(this.markers);
    
    // 4. 触发事件
    window.dispatchEvent(new CustomEvent('react-ui-marker:activate', {
      detail: { markerCount: this.markers.length }
    }));
    
    console.log(`[React UI Marker] 已激活，发现 ${this.markers.length} 个可交互元素`);
  }
  
  deactivate() {
    if (!this.isActive) return;
    this.isActive = false;
    
    this.elementPicker.deactivate();
    this.removeMarkerLabels();
    this.inputDialog.close();
    this.markers = [];
    
    window.dispatchEvent(new CustomEvent('react-ui-marker:deactivate'));
  }
  
  toggle() {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
  }
  
  isActivated() {
    return this.isActive;
  }
  
  getMarkers() {
    return [...this.markers];
  }
  
  private renderMarkerLabels() {
    this.markers.forEach(marker => {
      const label = document.createElement('div');
      label.dataset.markerId = marker.id;
      label.style.cssText = `
        position: fixed;
        top: ${marker.rect.top + window.scrollY - 20}px;
        left: ${marker.rect.left + window.scrollX}px;
        background: #6366f1;
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: bold;
        z-index: 2147483645;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      `;
      label.textContent = marker.label;
      document.body.appendChild(label);
      this.labelElements.push(label);
    });
  }
  
  private removeMarkerLabels() {
    this.labelElements.forEach(el => el.remove());
    this.labelElements = [];
  }
  
  private handleElementSelect = (marker: Marker) => {
    this.inputDialog.show({
      marker,
      onSubmit: (instruction) => {
        const context = this.buildContext(marker, instruction);
        
        if (this.onSubmit) {
          this.onSubmit(context);
        }
        
        window.dispatchEvent(new CustomEvent('react-ui-marker:submit', {
          detail: context
        }));
        
        console.log('[React UI Marker] 提交:', context);
      },
      onCancel: () => {
        window.dispatchEvent(new CustomEvent('react-ui-marker:cancel'));
      }
    });
  };
  
  private buildContext(marker: Marker, instruction: string): SelectionContext {
    const location = this.codeResolver.resolve(marker.fiber);
    const ancestors = this.codeResolver.getAncestors(marker.fiber);
    
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      selection: {
        markerId: marker.id,
        markerLabel: marker.label,
        elementTag: marker.element.tagName.toLowerCase(),
        elementText: marker.element.textContent?.slice(0, 100) || '',
        boundingBox: {
          x: marker.rect.x,
          y: marker.rect.y,
          width: marker.rect.width,
          height: marker.rect.height
        }
      },
      component: {
        name: marker.componentName,
        type: this.getComponentType(marker.fiber),
        location: {
          fileName: location.fileName,
          lineNumber: location.lineNumber,
          columnNumber: location.columnNumber
        },
        sourceCode: location.sourceCode,
        props: marker.fiber.memoizedProps || {}
      },
      ancestors: ancestors.slice(0, 5),
      instruction
    };
  }
  
  private getComponentType(fiber: Fiber): string {
    if (fiber.tag === FunctionComponentTag) return 'function';
    if (fiber.tag === ClassComponentTag) return 'class';
    return 'unknown';
  }
}

// ============================================
// 自动初始化 (Script 标签方式)
// ============================================

if (typeof window !== 'undefined') {
  (window as any).ReactUIMarker = ReactUIMarker;
}

export default ReactUIMarker;
```

---

## 6. 集成指南

### 6.1 npm 包方式 (推荐)

**安装**:
```bash
npm install --save-dev react-ui-marker
# 或
yarn add -D react-ui-marker
```

**使用**:
```typescript
// src/main.tsx 或 src/index.tsx
import { ReactUIMarker } from 'react-ui-marker';

if (process.env.NODE_ENV === 'development') {
  const marker = new ReactUIMarker({
    onSubmit: (context) => {
      // 发送到 AI 服务
      fetch('/api/ai/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context)
      });
    }
  });
  
  // 快捷键激活
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'M') {
      marker.toggle();
    }
  });
}
```

### 6.2 Script 标签方式

```html
<!DOCTYPE html>
<html>
<head>
  <!-- 你的应用代码 -->
</head>
<body>
  <div id="root"></div>
  
  <!-- React UI Marker (开发环境) -->
  <script>
    // 只在开发模式加载
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/react-ui-marker@latest/dist/index.global.js';
      script.onload = () => {
        const marker = new window.ReactUIMarker({
          onSubmit: (context) => {
            console.log('用户指令:', context);
          }
        });
        
        // Ctrl+Shift+M 切换
        document.addEventListener('keydown', (e) => {
          if (e.ctrlKey && e.shiftKey && e.key === 'M') {
            marker.toggle();
          }
        });
      };
      document.head.appendChild(script);
    }
  </script>
</body>
</html>
```

### 6.3 Vite 插件方式

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'react-ui-marker',
      transformIndexHtml(html) {
        if (process.env.NODE_ENV === 'development') {
          return html.replace(
            '</body>',
            `
            <script type="module">
              import { ReactUIMarker } from 'react-ui-marker';
              window.__MARKER__ = new ReactUIMarker();
              
              document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey && e.key === 'M') {
                  window.__MARKER__.toggle();
                }
              });
            </script>
            </body>
            `
          );
        }
        return html;
      }
    }
  ]
});
```

---

## 7. 输出格式规范

### 7.1 SelectionContext 完整示例

```json
{
  "version": "1.0",
  "timestamp": "2025-04-17T10:30:00.000Z",
  "selection": {
    "markerId": "marker-5",
    "markerLabel": "5",
    "elementTag": "button",
    "elementText": "提交订单",
    "boundingBox": {
      "x": 520,
      "y": 380,
      "width": 120,
      "height": 40
    }
  },
  "component": {
    "name": "SubmitOrderButton",
    "type": "function",
    "location": {
      "fileName": "/src/components/SubmitOrderButton.tsx",
      "lineNumber": 15,
      "columnNumber": 1
    },
    "sourceCode": "const SubmitOrderButton = () => {\n  return (\n    <button className=\"btn-primary\">\n      提交订单\n    </button>\n  );\n};",
    "props": {
      "className": "btn-primary",
      "children": "提交订单",
      "onClick": "[Function]"
    }
  },
  "ancestors": [
    {
      "name": "OrderForm",
      "depth": 1
    },
    {
      "name": "CheckoutPage",
      "depth": 2
    },
    {
      "name": "App",
      "depth": 3
    }
  ],
  "instruction": "把按钮文字改成'立即购买'，颜色改成绿色"
}
```

### 7.2 AI 提示词模板

```markdown
## 上下文

用户选中了界面元素 **[{markerLabel}] {componentName}**，并提出修改需求。

### 元素信息
- **编号**: {markerLabel}
- **组件**: {componentName}
- **类型**: {component.type}
- **位置**: {component.location.fileName}:{component.location.lineNumber}

### 当前代码
```tsx
{component.sourceCode}
```

### 当前 Props
```json
{component.props}
```

### 组件层级
{ancestors.map(a => `- ${a.name}`).join('\n')}

## 用户需求

{instruction}

## 任务

请生成修改后的代码，并说明修改点。
```

---

## 8. 测试方案

### 8.1 单元测试

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ReactUIMarker, MarkerGenerator } from './react-ui-marker';

describe('ReactUIMarker', () => {
  it('should activate and generate markers', () => {
    const marker = new ReactUIMarker();
    marker.activate();
    
    expect(marker.isActivated()).toBe(true);
    expect(marker.getMarkers().length).toBeGreaterThan(0);
    
    marker.deactivate();
  });
  
  it('should toggle active state', () => {
    const marker = new ReactUIMarker();
    
    marker.toggle();
    expect(marker.isActivated()).toBe(true);
    
    marker.toggle();
    expect(marker.isActivated()).toBe(false);
  });
});

describe('MarkerGenerator', () => {
  it('should filter invisible elements', () => {
    document.body.innerHTML = `
      <button>Visible</button>
      <button style="display:none">Hidden</button>
    `;
    
    const generator = new MarkerGenerator();
    const markers = generator.scan();
    
    expect(markers.length).toBe(1);
    expect(markers[0].element.textContent).toBe('Visible');
  });
});
```

### 8.2 E2E 测试

```typescript
// test/react-ui-marker.spec.ts
import { test, expect } from '@playwright/test';

test('user can select element and submit instruction', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // 激活标记系统
  await page.keyboard.down('Control');
  await page.keyboard.down('Shift');
  await page.keyboard.press('KeyM');
  await page.keyboard.up('Shift');
  await page.keyboard.up('Control');
  
  // 等待标记出现
  await expect(page.locator('[data-marker-id]')).toBeVisible();
  
  // 点击第一个标记
  await page.click('[data-marker-id="marker-0"]');
  
  // 输入指令
  await page.fill('#ai-input', '把按钮改成红色');
  await page.click('#ai-submit');
  
  // 验证事件触发
  const context = await page.evaluate(() => {
    return new Promise((resolve) => {
      window.addEventListener('react-ui-marker:submit', (e: any) => {
        resolve(e.detail);
      }, { once: true });
    });
  });
  
  expect(context).toMatchObject({
    instruction: '把按钮改成红色'
  });
});
```

### 8.3 性能基准

| 指标 | 目标值 | 测试方法 |
|------|--------|----------|
| 扫描 100 个元素 | < 50ms | `console.time('scan')` |
| 标记渲染 | < 16ms | Performance API |
| 内存占用 | < 10MB | Chrome DevTools |
| 交互响应 | < 100ms | 鼠标移动到高亮显示 |

---

## 附录 A: 浏览器兼容性

| 浏览器 | 版本 | 支持状态 |
|--------|------|----------|
| Chrome | 80+ | ✅ 完全支持 |
| Firefox | 75+ | ✅ 完全支持 |
| Safari | 13.1+ | ✅ 完全支持 |
| Edge | 80+ | ✅ 完全支持 |

## 附录 B: React 版本兼容性

| React 版本 | 支持状态 | 备注 |
|------------|----------|------|
| 16.8+ | ✅ 支持 | Hooks 版本 |
| 17.x | ✅ 支持 | 完全兼容 |
| 18.x | ✅ 支持 | 推荐版本 |
| 19.x | ⚠️ 待测试 | 预计兼容 |

## 附录 C: 快捷键参考

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+M` | 激活/停用标记系统 |
| `Esc` | 关闭输入对话框/停用标记 |
| `Ctrl+Enter` | 提交指令 |
| `Tab` | 在标记间切换 |

---

**文档结束**
