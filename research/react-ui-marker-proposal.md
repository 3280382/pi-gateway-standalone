# React 界面控件 AI 交互标记系统 - 研究方案

> **版本**: v1.0  
> **日期**: 2025-04-17  
> **状态**: 研究阶段  

---

## 1. 问题定义

### 1.1 现状痛点

在复杂的 React 应用中，用户面临以下问题：

- **界面元素难以描述**: 页面上有大量按钮、面板、弹窗、控件
- **表达不清晰**: 用户只能用"左上角红色按钮"、"第二个输入框"等模糊描述
- **代码映射困难**: HTML 元素与 React 组件没有直接对应关系
- **沟通成本高**: AI 难以理解用户的具体修改意图

### 1.2 目标愿景

开发一个**前端插件系统**，实现：

1. 🔍 **可视化标记**: 激活后对整个界面的控件进行标记
2. 👆 **点击选择**: 用户点击元素后弹出输入框
3. 💬 **自然语言**: 用户直接描述对该元素的修改需求
4. 🎯 **精准定位**: 系统自动找到对应的 React 组件和代码位置

---

## 2. 技术调研

### 2.1 React 内部机制

#### 2.1.1 React Fiber 架构

React 16+ 使用 Fiber 架构来管理组件树。每个 React 元素对应一个 Fiber 节点：

```typescript
interface Fiber {
  tag: number;                    // 组件类型标记
  type: any;                      // 组件类型（函数/类/HTML标签）
  stateNode: any;                 // 对应的 DOM 节点或组件实例
  return: Fiber | null;           // 父 Fiber
  child: Fiber | null;            // 第一个子 Fiber
  sibling: Fiber | null;          // 下一个兄弟 Fiber
  memoizedProps: any;             // 当前 props
  memoizedState: any;             // 当前 state
  alternate: Fiber | null;        // 双缓存中的另一棵树
  // ...
}
```

**关键发现**: React 在 DOM 元素上存储了内部引用，可以通过特定属性访问 Fiber。

#### 2.1.2 DOM 到 Fiber 的映射

React 在渲染时会在 DOM 元素上设置内部属性：

```javascript
// React 18 之前的版本
element.__reactInternalInstance$[randomKey]

// React 18+
element.__reactFiber$[randomKey]

// React 根容器
element._reactRootContainer
```

**原理**: React DevTools 和 bippy 等工具利用这些内部属性建立 DOM 到 Fiber 的映射。

### 2.2 现有解决方案分析

#### 2.2.1 React DevTools

**架构**:
```
┌─────────────────┐     Bridge      ┌─────────────────┐
│   Frontend      │ ◄──────────────► │    Backend      │
│  (Extension UI) │   (postMessage)  │  (Hooks into    │
│                 │                  │   React)        │
└─────────────────┘                  └─────────────────┘
```

**关键技术**:
- 注入 `__REACT_DEVTOOLS_GLOBAL_HOOK__` 全局钩子
- 拦截 React 的 `onCommitFiberRoot` 和 `onCommitFiberUnmount`
- 使用 `renderer.findFiberByHostInstance(domElement)` 查找 Fiber

**局限性**:
- 需要安装浏览器扩展
- 主要用于调试，不提供标记/选择功能
- 无法直接集成到 AI 工作流

#### 2.2.2 react-scan

**特点**:
- 零代码侵入，通过 `<script>` 标签注入
- 自动检测性能问题并高亮渲染
- 提供 Inspector 组件树查看功能

**核心技术**:
```typescript
// 从 DOM 元素获取 Fiber
export const getFiberFromElement = (element: Element): Fiber | null => {
  // 方法1: 通过 React DevTools Hook
  if ('__REACT_DEVTOOLS_GLOBAL_HOOK__' in window) {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    for (const [, renderer] of Array.from(hook.renderers)) {
      const fiber = renderer.findFiberByHostInstance?.(element);
      if (fiber) return fiber;
    }
  }
  
  // 方法2: 通过 React 内部属性
  for (const key in element) {
    if (key.startsWith('__reactInternalInstance$') || 
        key.startsWith('__reactFiber')) {
      return element[key];
    }
  }
  return null;
};
```

**高亮实现**:
- 使用 `Canvas` 覆盖层绘制高亮边框
- `requestAnimationFrame` 实现平滑动画
- 计算元素的 `getBoundingClientRect()` 定位

#### 2.2.3 bippy

**定位**: 轻量级 React 内部访问库

**核心功能**:
```typescript
// 安装全局 Hook
const rdtHook = getRDTHook(onActive);

// 从 DOM 获取 Fiber
const fiber = getFiberFromHostInstance(domElement);

// 遍历 Fiber 树
traverseFiber(fiber, (node) => {
  if (isCompositeFiber(node)) {
    console.log(getDisplayName(node.type));
  }
});

// 获取最近的宿主元素
const hostFiber = getNearestHostFiber(fiber);
```

**优势**:
- 兼容 React 16-19
- 支持所有 React 渲染器（DOM、Native、Three.js）
- 轻量级，无依赖

### 2.3 可视化选择器实现

#### 2.3.1 浏览器开发者工具 Element Picker 原理

```javascript
class ElementPicker {
  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
      background: rgba(128, 128, 255, 0.3);
      border: 2px solid rgb(128, 128, 255);
      transition: all 0.1s ease;
    `;
  }
  
  activate() {
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('click', this.onClick, true);
  }
  
  onMouseMove = (e) => {
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (target) {
      const rect = target.getBoundingClientRect();
      this.overlay.style.top = rect.top + 'px';
      this.overlay.style.left = rect.left + 'px';
      this.overlay.style.width = rect.width + 'px';
      this.overlay.style.height = rect.height + 'px';
    }
  };
}
```

#### 2.3.2 标记系统方案

**方案A: 数字标签（推荐）**
```
┌─────────────────┐
│  [1] Button A   │
│  [2] Button B   │
└─────────────────┘
```

- 优点: 紧凑，不遮挡内容
- 缺点: 需要额外的提示显示组件名称

**方案B: 名称标签**
```
┌─────────────────────────────────────┐
│  ┌──────────────┐                   │
│  │ SubmitButton │ ←── 浮动标签       │
│  └──────────────┘                   │
│  ┌──────────────┐                   │
│  │ CancelButton │                   │
│  └──────────────┘                   │
└─────────────────────────────────────┘
```

- 优点: 直观显示组件名
- 缺点: 可能重叠，需要智能布局算法

**方案C: 混合模式（推荐）**
```
┌─────────────────────────────────────┐
│  ┌──────────────┐                   │
│  │ ① │SubmitBtn │ ←── 数字+缩写     │
│  └──────────────┘                   │
│  ┌──────────────┐                   │
│  │ ② │CancelBtn │                   │
│  └──────────────┘                   │
└─────────────────────────────────────┘
```

---

## 3. 系统设计方案

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Interface Layer                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Overlay    │  │  Picker UI   │  │  Input Dialog        │  │
│  │  (Canvas)    │  │  (Hover Box) │  │  (Floating Input)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      Core Engine Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Marker     │  │  Element     │  │  React Resolver      │  │
│  │  Generator   │  │  Selector    │  │  (DOM → Fiber → Code)│  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      Integration Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   BIPPY      │  │  DevTools    │  │  Source Map          │  │
│  │  (Fiber API) │  │  Hook        │  │  Resolver            │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 核心模块设计

#### 3.2.1 标记生成器 (MarkerGenerator)

```typescript
interface Marker {
  id: string;
  element: HTMLElement;
  rect: DOMRect;
  componentName: string;
  fiber: Fiber;
  label: string;
  priority: number;
}

class MarkerGenerator {
  // 扫描所有可交互元素
  scan(root: HTMLElement = document.body): Marker[] {
    const elements = root.querySelectorAll(
      'button, input, select, textarea, [role="button"], [role="input"], a, label'
    );
    
    return Array.from(elements)
      .map((el, index) => this.createMarker(el as HTMLElement, index))
      .filter(Boolean) as Marker[];
  }
  
  // 创建单个标记
  private createMarker(element: HTMLElement, index: number): Marker | null {
    const fiber = getFiberFromElement(element);
    if (!fiber) return null;
    
    const compositeFiber = this.findCompositeFiber(fiber);
    if (!compositeFiber) return null;
    
    return {
      id: `marker-${index}`,
      element,
      rect: element.getBoundingClientRect(),
      componentName: getDisplayName(compositeFiber.type) || 'Unknown',
      fiber: compositeFiber,
      label: (index + 1).toString(),
      priority: this.calculatePriority(element)
    };
  }
  
  // 查找复合组件（函数组件/类组件）
  private findCompositeFiber(fiber: Fiber): Fiber | null {
    let current: Fiber | null = fiber;
    while (current) {
      if (isCompositeFiber(current)) return current;
      current = current.return;
    }
    return null;
  }
  
  // 计算优先级（可见性、大小等）
  private calculatePriority(element: HTMLElement): number {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    let score = 0;
    if (style.display !== 'none') score += 10;
    if (style.visibility !== 'hidden') score += 10;
    if (rect.width > 10 && rect.height > 10) score += 10;
    if (element.disabled) score -= 5;
    
    return score;
  }
}
```

#### 3.2.2 元素选择器 (ElementPicker)

```typescript
class ElementPicker {
  private overlay: HTMLElement;
  private label: HTMLElement;
  private onSelect: (marker: Marker) => void;
  private markers: Map<HTMLElement, Marker> = new Map();
  
  constructor(onSelect: (marker: Marker) => void) {
    this.onSelect = onSelect;
    this.overlay = this.createOverlay();
    this.label = this.createLabel();
  }
  
  activate(markers: Marker[]) {
    // 构建快速查找映射
    this.markers.clear();
    markers.forEach(m => this.markers.set(m.element, m));
    
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick, true);
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.label);
  }
  
  private handleMouseMove = (e: MouseEvent) => {
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target) return;
    
    // 查找最近的标记元素
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
  
  // 向上查找标记元素
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
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      border: 2px solid #6366f1;
      background: rgba(99, 102, 241, 0.1);
      border-radius: 4px;
      pointer-events: none;
      z-index: 2147483646;
      transition: all 0.1s ease;
    `;
    
    this.label.style.cssText = `
      position: fixed;
      top: ${rect.top - 28}px;
      left: ${rect.left}px;
      background: #6366f1;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      z-index: 2147483647;
      white-space: nowrap;
    `;
    this.label.textContent = `[${marker.label}] ${marker.componentName}`;
  }
  
  private hideOverlay() {
    this.overlay.style.display = 'none';
    this.label.style.display = 'none';
  }
  
  deactivate() {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleClick, true);
    this.overlay.remove();
    this.label.remove();
  }
}
```

#### 3.2.3 代码定位器 (CodeResolver)

```typescript
interface ComponentLocation {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
  componentName: string;
  sourceCode: string;
  props: Record<string, any>;
}

class CodeResolver {
  // 解析 Fiber 获取组件位置
  async resolve(fiber: Fiber): Promise<ComponentLocation | null> {
    const componentType = fiber.type;
    
    // 获取组件名称
    const componentName = getDisplayName(componentType);
    if (!componentName) return null;
    
    // 获取源码位置
    const sourceLocation = this.getSourceLocation(componentType);
    if (!sourceLocation) return null;
    
    return {
      ...sourceLocation,
      componentName,
      props: fiber.memoizedProps || {},
      sourceCode: await this.fetchSourceCode(sourceLocation)
    };
  }
  
  private getSourceLocation(type: any): { fileName: string; lineNumber: number; columnNumber: number } | null {
    // 方法1: 使用 source map
    const error = new Error();
    const stack = error.stack || '';
    
    // 解析 stack trace
    const lines = stack.split('\n');
    for (const line of lines) {
      const match = line.match(/at\s+.*?\s+\((.*?):(\d+):(\d+)\)/);
      if (match) {
        return {
          fileName: match[1],
          lineNumber: parseInt(match[2], 10),
          columnNumber: parseInt(match[3], 10)
        };
      }
    }
    
    // 方法2: React 内部属性 (开发模式)
    if (type?.__source) {
      return {
        fileName: type.__source.fileName,
        lineNumber: type.__source.lineNumber,
        columnNumber: type.__source.columnNumber || 0
      };
    }
    
    return null;
  }
  
  private async fetchSourceCode(location: { fileName: string }): Promise<string> {
    try {
      const response = await fetch(location.fileName);
      const text = await response.text();
      return text;
    } catch {
      return '';
    }
  }
}
```

#### 3.2.4 输入对话框 (InputDialog)

```typescript
interface InputDialogOptions {
  marker: Marker;
  onSubmit: (data: { marker: Marker; instruction: string }) => void;
  onCancel: () => void;
}

class InputDialog {
  private container: HTMLElement;
  
  show(options: InputDialogOptions) {
    const { marker } = options;
    
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
        "
      ></textarea>
      <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px;">
        <button id="ai-cancel" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 6px; cursor: pointer;">取消</button>
        <button id="ai-submit" style="padding: 8px 16px; border: none; background: #6366f1; color: white; border-radius: 6px; cursor: pointer;">提交</button>
      </div>
    `;
    
    this.container.appendChild(dialog);
    document.body.appendChild(this.container);
    
    // 绑定事件
    const textarea = dialog.querySelector('#ai-input') as HTMLTextAreaElement;
    const submitBtn = dialog.querySelector('#ai-submit') as HTMLButtonElement;
    const cancelBtn = dialog.querySelector('#ai-cancel') as HTMLButtonElement;
    
    textarea.focus();
    
    submitBtn.onclick = () => {
      options.onSubmit({ marker, instruction: textarea.value });
      this.close();
    };
    
    cancelBtn.onclick = () => {
      options.onCancel();
      this.close();
    };
    
    this.container.onclick = (e) => {
      if (e.target === this.container) {
        options.onCancel();
        this.close();
      }
    };
  }
  
  close() {
    this.container?.remove();
  }
}
```

### 3.3 主控制器

```typescript
class ReactUIMarker {
  private markerGenerator: MarkerGenerator;
  private elementPicker: ElementPicker;
  private codeResolver: CodeResolver;
  private inputDialog: InputDialog;
  private markers: Marker[] = [];
  private isActive = false;
  
  constructor() {
    this.markerGenerator = new MarkerGenerator();
    this.codeResolver = new CodeResolver();
    this.inputDialog = new InputDialog();
    
    this.elementPicker = new ElementPicker(this.handleElementSelect);
  }
  
  // 激活标记系统
  activate() {
    if (this.isActive) return;
    this.isActive = true;
    
    // 1. 生成标记
    this.markers = this.markerGenerator.scan();
    
    // 2. 渲染标记标签
    this.renderMarkerLabels();
    
    // 3. 激活选择器
    this.elementPicker.activate(this.markers);
    
    console.log(`[React UI Marker] 已激活，发现 ${this.markers.length} 个可交互元素`);
  }
  
  // 停用
  deactivate() {
    this.isActive = false;
    this.elementPicker.deactivate();
    this.removeMarkerLabels();
    this.markers = [];
  }
  
  // 渲染标记标签
  private renderMarkerLabels() {
    this.markers.forEach(marker => {
      const label = document.createElement('div');
      label.dataset.markerId = marker.id;
      label.style.cssText = `
        position: fixed;
        top: ${marker.rect.top - 20}px;
        left: ${marker.rect.left}px;
        background: #6366f1;
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: bold;
        z-index: 2147483645;
        pointer-events: none;
      `;
      label.textContent = marker.label;
      document.body.appendChild(label);
    });
  }
  
  private removeMarkerLabels() {
    document.querySelectorAll('[data-marker-id]').forEach(el => el.remove());
  }
  
  // 处理元素选择
  private handleElementSelect = async (marker: Marker) => {
    // 1. 解析代码位置
    const location = await this.codeResolver.resolve(marker.fiber);
    
    // 2. 显示输入对话框
    this.inputDialog.show({
      marker,
      onSubmit: (data) => {
        this.handleInstructionSubmit(data, location);
      },
      onCancel: () => {
        // 继续选择模式
      }
    });
  };
  
  // 处理指令提交
  private handleInstructionSubmit(
    data: { marker: Marker; instruction: string },
    location: ComponentLocation | null
  ) {
    const context = {
      marker: {
        id: data.marker.id,
        label: data.marker.label,
        componentName: data.marker.componentName
      },
      location,
      currentProps: data.marker.fiber.memoizedProps,
      instruction: data.instruction
    };
    
    // 触发事件或回调，将上下文发送给 AI
    window.dispatchEvent(new CustomEvent('react-ui-marker:submit', {
      detail: context
    }));
    
    console.log('[React UI Marker] 用户指令:', context);
  }
}
```

---

## 4. 命名规范与代码标记建议

### 4.1 React 组件命名规范

为了让系统能更好地识别组件，建议遵循以下命名规范：

```typescript
// ✅ 推荐：语义化、唯一的组件名
const UserProfileCard = () => {};
const SubmitOrderButton = () => {};
const ProductDetailModal = () => {};

// ❌ 避免：过于通用的命名
const Card = () => {};
const Button = () => {};
const Modal = () => {};

// ✅ 推荐：使用 data-component 属性标记
<button data-component="SaveButton">保存</button>

// ✅ 推荐：使用 data-purpose 描述用途
<input data-purpose="user-email-input" />
```

### 4.2 Source Map 配置

开发模式下，确保 Source Map 正确生成：

```javascript
// vite.config.js
export default {
  build: {
    sourcemap: true,  // 启用 source map
  },
};

// webpack.config.js
module.exports = {
  devtool: 'eval-source-map',  // 开发模式
  // devtool: 'source-map',    // 生产模式
};
```

### 4.3 开发模式标识注入

在开发模式下注入辅助信息：

```typescript
// 开发模式下为组件添加 __source 属性
if (process.env.NODE_ENV === 'development') {
  const originalCreateElement = React.createElement;
  
  React.createElement = function(type, props, ...children) {
    if (typeof type === 'function') {
      const error = new Error();
      const stack = error.stack?.split('\n')[2] || '';
      const match = stack.match(/at\s+.*?\s+\((.*?):(\d+):(\d+)\)/);
      
      if (match) {
        props = {
          ...props,
          'data-source': `${match[1]}:${match[2]}:${match[3]}`
        };
      }
    }
    return originalCreateElement(type, props, ...children);
  };
}
```

---

## 5. 技术实现路线图

### 阶段一: 基础原型 (2周)

1. **Fiber 访问层**
   - 集成 bippy 库
   - 实现 `getFiberFromElement`
   - 实现 `getCompositeFiber`

2. **标记渲染层**
   - 扫描可交互元素
   - 生成数字标签
   - Canvas 高亮框

3. **选择交互层**
   - 鼠标悬停高亮
   - 点击选择
   - 简单输入框

### 阶段二: 智能定位 (2周)

1. **代码定位**
   - Source Map 解析
   - 组件文件定位
   - 代码片段提取

2. **智能命名**
   - 组件语义分析
   - 自动标签生成
   - 冲突检测

### 阶段三: AI 集成 (2周)

1. **上下文构建**
   - 组件 props 提取
   - 样式信息收集
   - 相关代码关联

2. **指令解析**
   - 自然语言处理
   - 意图识别
   - 代码生成建议

### 阶段四: 工程化 (1周)

1. **打包发布**
   - 独立 npm 包
   - 浏览器扩展
   - Bookmarklet

2. **性能优化**
   - 虚拟滚动支持
   - 懒加载标记
   - 缓存机制

---

## 6. 使用方式设计

### 6.1 作为 npm 包使用

```bash
npm install --save-dev react-ui-marker
```

```typescript
// main.tsx
import { ReactUIMarker } from 'react-ui-marker';

if (process.env.NODE_ENV === 'development') {
  const marker = new ReactUIMarker();
  
  // 快捷键激活 (Ctrl+Shift+M)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'M') {
      marker.activate();
    }
    if (e.key === 'Escape') {
      marker.deactivate();
    }
  });
  
  // 监听用户指令
  window.addEventListener('react-ui-marker:submit', (e) => {
    const { marker, instruction, location } = e.detail;
    
    // 发送到 AI 服务
    sendToAI({
      component: marker.componentName,
      file: location?.fileName,
      line: location?.lineNumber,
      instruction
    });
  });
}
```

### 6.2 作为 Script 标签使用

```html
<!-- 开发环境 -->
<script src="https://unpkg.com/react-ui-marker@latest/dist/auto.global.js"></script>
<script>
  // 按 Ctrl+Shift+M 激活
  ReactUIMarker.init({
    shortcut: 'Ctrl+Shift+M',
    onSubmit: (data) => {
      console.log('用户指令:', data);
    }
  });
</script>
```

### 6.3 作为浏览器扩展

- 一键激活/停用
- 配置面板
- 历史记录

---

## 7. 预期输出格式

当用户选择元素并提交指令后，系统应输出以下格式的上下文：

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
    },
    "state": {},
    "hooks": []
  },
  "ancestors": [
    {
      "name": "OrderForm",
      "depth": 1,
      "location": "/src/pages/OrderForm.tsx:23"
    },
    {
      "name": "App",
      "depth": 2,
      "location": "/src/App.tsx:10"
    }
  ],
  "instruction": "把按钮文字改成'立即购买'，颜色改成绿色",
  "suggestedChanges": [
    {
      "fileName": "/src/components/SubmitOrderButton.tsx",
      "lineNumber": 17,
      "type": "prop-change",
      "description": "修改按钮文字",
      "from": "提交订单",
      "to": "立即购买"
    },
    {
      "fileName": "/src/components/SubmitOrderButton.tsx", 
      "lineNumber": 16,
      "type": "class-change",
      "description": "修改按钮颜色为绿色",
      "from": "btn-primary",
      "to": "btn-success"
    }
  ]
}
```

---

## 8. 技术风险与应对

### 8.1 React 版本兼容性

| 风险 | 影响 | 应对 |
|------|------|------|
| React 内部 API 变更 | 高 | 使用 bippy 等抽象库，定期更新 |
| Fiber 结构变化 | 高 | 编写适配层，支持多版本 |
| 生产模式优化 | 中 | 只在开发模式运行，文档明确说明 |

### 8.2 性能风险

| 风险 | 影响 | 应对 |
|------|------|------|
| 大量 DOM 元素扫描 | 中 | 使用 Intersection Observer，虚拟滚动 |
| Canvas 重绘开销 | 低 | requestAnimationFrame 节流 |
| Fiber 遍历深度 | 低 | 设置最大深度限制 |

### 8.3 安全风险

| 风险 | 影响 | 应对 |
|------|------|------|
| XSS 通过 props 注入 | 中 | 严格转义用户输入 |
| Source Map 泄露 | 中 | 只在开发模式使用 |
| 代码执行 | 高 | 禁用 eval，使用 CSP |

---

## 9. 参考资源

### 9.1 开源项目

- **react-scan**: https://github.com/aidenybai/react-scan
- **bippy**: https://github.com/aidenybai/bippy
- **React DevTools**: https://github.com/facebook/react/tree/main/packages/react-devtools

### 9.2 文档

- React Fiber 架构: https://github.com/acdlite/react-fiber-architecture
- React DevTools Overview: https://github.com/facebook/react/blob/main/packages/react-devtools/OVERVIEW.md

### 9.3 相关技术

- `__REACT_DEVTOOLS_GLOBAL_HOOK__` 协议
- Source Map V3 规范
- Custom Elements API
- MutationObserver API

---

## 10. 结论与建议

### 10.1 核心结论

1. **技术可行**: 通过 `__reactFiber` 等内部属性可以实现 DOM 到 React 组件的映射
2. **方案成熟**: react-scan 等项目已验证技术路线
3. **集成友好**: 可作为独立包、脚本或扩展多种形态部署

### 10.2 实施建议

1. **优先实现基础功能**: 标记生成 + 元素选择 + 简单输入
2. **依赖成熟库**: 使用 bippy 处理 Fiber 访问，避免重复造轮子
3. **开发模式优先**: 初期只在开发模式运行，规避生产环境风险
4. **渐进式增强**: 先提供基本信息，逐步增加 Source Map 解析等高级功能

### 10.3 下一步行动

1. [ ] 搭建项目骨架，集成 bippy
2. [ ] 实现基础标记渲染
3. [ ] 实现元素选择和输入框
4. [ ] 构建测试 Demo 验证效果
5. [ ] 收集反馈，迭代优化

---

**文档结束**
