# React UI Marker - 产品技术规格文档 v2.0

**文档版本**: 2.0  
**重构日期**: 2025-04-17  
**文档定位**: 产品级实现方案（非研究型）  

> **设计哲学转变**: 从"精确理解 React"转向"给 AI 足够信息去理解 UI"

---

## ⚠️ 产品形态定义（必读）

### 目标形态

这是一个**独立的浏览器端 JavaScript 工具**，具有以下特征：

```
┌─────────────────────────────────────────┐
│  最终交付物                              │
├─────────────────────────────────────────┤
│  📦 ui-marker.js          (核心脚本，~10KB) │
│  📄 demo.html             (功能演示页面)   │
│  🧪 test.html             (测试验证页面)   │
│  📖 README.md             (使用说明)       │
└─────────────────────────────────────────┘
```

### 使用方式（极简）

**Step 1**: 在任何项目的 `index.html` 中引入

```html
<!DOCTYPE html>
<html>
<body>
  <!-- 你的应用内容 -->
  <div id="app">...</div>
  
  <!-- 引入 UI Marker（仅开发环境） -->
  <script>
    if (location.hostname === 'localhost') {
      const script = document.createElement('script');
      script.src = './ui-marker.js';
      document.body.appendChild(script);
    }
  </script>
</body>
</html>
```

**Step 2**: 按 `Ctrl+Shift+M` 激活

**Step 3**: 点击元素，输入指令，提交给 AI

### 技术约束（严格遵守）

| 约束 | 说明 |
|------|------|
| **零依赖** | 不能依赖 React/Vue/Angular 等框架开发 |
| **原生 JS** | 使用原生 ES6+ JavaScript，无构建工具依赖 |
| **单文件** | 最终输出单个 `.js` 文件，直接可用 |
| **自包含** | 所有 CSS、HTML 模板内嵌在 JS 中 |
| **即插即用** | 引入后立即可用，无需配置 |

### UI 设计原则

**简洁至上，低干扰**：

```
激活前: 页面保持原样，无任何变化

激活后: 
  ┌─────────────────────────────┐
  │                             │
  │  [1]  [2]        [3]       │  ← 小圆点标记，不遮挡内容
  │   ○    ○          ○        │
  │                             │
  │  ┌──────────┐               │
  │  │  [4]     │               │
  │  │   ○      │               │
  │  └──────────┘               │
  │                             │
  └─────────────────────────────┘

鼠标悬停:
  ┌─────────────────────────────┐
  │                             │
  │  ┌────┐                     │
  │  │[4] │ ← 高亮框            │
  │  └──┬─┘                     │
  │     │                       │
  │  ┌──┴──┐ ← 信息卡片         │
  │  │ button    │              │
  │  │ 提交订单  │              │
  │  └───────────┘              │
  │                             │
  └─────────────────────────────┘

点击后: 简洁输入框
  ┌─────────────────────────────────────────┐
  │  元素 [4] button              [×]       │
  ├─────────────────────────────────────────┤
  │                                         │
  │  描述修改需求：                          │
  │  ┌─────────────────────────────────┐   │
  │  │ 改成红色，文字改为"立即购买"      │   │
  │  └─────────────────────────────────┘   │
  │                                         │
  │        [取消]        [确认]             │
  │                                         │
  └─────────────────────────────────────────┘
```

**设计要点**:
- 标记使用 **小圆点 + 数字**，不遮挡内容
- 高亮使用 **细边框 + 半透明背景**
- 输入框 **居中显示**，简洁无干扰
- 支持 **ESC 取消**、**Enter 确认**

### 目录结构

```
ui-marker/
├── dist/
│   └── ui-marker.js          # 核心脚本（单文件，自包含）
├── demo/
│   ├── demo.html             # 功能演示页面
│   ├── simple.html           # 简单示例
│   └── complex.html          # 复杂页面示例
├── test/
│   ├── test.html             # 测试页面
│   └── test-cases.js         # 测试用例
├── src/
│   └── ui-marker.js          # 源码（开发用）
└── README.md                 # 使用说明
```

### Demo 页面要求

**demo.html** 必须包含：

1. **基础演示区**: 按钮、输入框、链接等常见元素
2. **复杂嵌套区**: 多层嵌套结构，测试路径收集
3. **动态内容区**: 异步加载的内容，测试动态标记
4. **使用说明**: 快捷键提示、操作步骤

**效果**: 打开 demo.html，按 `Ctrl+Shift+M`，即可体验完整功能。

---

## 给 AI 的开发指令

如果你是 AI 开发者，请按照以下要求实现：

### 必须交付

1. **ui-marker.js** - 单文件，原生 JS，零依赖
2. **demo.html** - 包含多种测试场景
3. **test.html** - 自动化测试验证

### 代码规范

```javascript
// 使用原生 ES6+，无框架
class UIMarker {
  // 所有 CSS 内嵌
  // 所有 HTML 模板内嵌
  // 不依赖任何外部库
}

// 自动初始化
if (typeof window !== 'undefined') {
  window.UIMarker = UIMarker;
  // 可选：自动实例化
  // window.uiMarker = new UIMarker();
}
```

### 验收标准

- [ ] 引入单个 JS 文件即可工作
- [ ] `Ctrl+Shift+M` 激活/停用
- [ ] 显示数字标记（小圆点）
- [ ] 鼠标悬停高亮 + 信息卡片
- [ ] 点击弹出输入框
- [ ] 输出包含 DOM 路径、文本、线索
- [ ] Demo 页面展示所有功能
- [ ] 测试页面验证核心逻辑

---

---

## 0. 核心设计变化（v1.0 → v2.0）

| 维度 | v1.0（研究型） | v2.0（产品型） |
|------|----------------|----------------|
| **核心依赖** | React Fiber、__reactFiber、DevTools Hook | DOM API + 可选 data-* 标记 |
| **定位策略** | DOM → Fiber → 精确组件 → 精确源码 | DOM → 上下文收集 → AI 推断 |
| **稳定性要求** | 假设 React 内部 API 可用 | 不依赖 React 内部机制也能工作 |
| **输出目标** | 精确的代码位置和源码 | 多维定位线索 + 上下文 |
| **失败处理** | 系统不可用 | 优雅降级，基础功能仍可用 |
| **侵入性** | 需要劫持或深度集成 | 零侵入，渐进增强 |

### 降级可用性原则（核心）

```
系统应该在不理解 React 的情况下也能运行，只是效果变弱

Level 1（基础）: DOM 选择 + 高亮 + 输入  → 100% 可用
Level 2（增强）: data-* 标记识别        → 80% 可用  
Level 3（高级）: React 信息             → 不保证，有更好
```

---

## 1. 产品定位与目标

### 1.1 解决的问题

用户在复杂 Web 应用中与 AI 协作时：

- ❌ "把那个红色按钮改成蓝色" → AI不知道"那个"是哪个
- ❌ "订单页面的提交按钮" → AI不知道"订单页面"对应什么代码
- ❌ "左边第二个输入框" → 页面布局一变就失效

### 1.2 解决方案

提供一个**浏览器端可视化选择器**：

1. 用户按快捷键激活系统
2. 可交互元素显示编号标签
3. 鼠标悬停高亮，点击选中
4. 弹出输入框描述修改需求
5. 系统收集**多维上下文信息**
6. AI 基于上下文推断并定位代码

### 1.3 核心指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 首次激活成功率 | >99% | 不依赖 React 特定版本 |
| 元素标记覆盖率 | >90% | 可交互元素都能被标记 |
| 信息收集完整度 | >80% | Level 1+2 信息完整 |
| 对应用影响 | 零 | 不修改应用代码 |

---

## 2. 分层能力模型（关键设计）

### 2.1 三层架构

```
┌─────────────────────────────────────────┐
│         Level 3: 高级增强（不稳定）       │
│  - React Fiber 信息（如果有）             │
│  - 组件树结构（如果能获取）               │
│  - 运行时 Props（如果可访问）             │
│  【失败不影响核心功能】                   │
├─────────────────────────────────────────┤
│         Level 2: 增强功能（推荐）         │
│  - data-ai-id / data-component 标记       │
│  - data-testid / data-cy 等测试标记       │
│  - 语义化类名推断                         │
│  【开发者可选配置，提升精度】              │
├─────────────────────────────────────────┤
│         Level 1: 基础功能（必须）         │
│  - DOM 元素选择                           │
│  - 高亮交互                               │
│  - 用户输入收集                           │
│  - 基础上下文（tag/text/path）            │
│  【100% 可用，不依赖任何框架】             │
└─────────────────────────────────────────┘
```

### 2.2 各层能力说明

#### Level 1: 基础层（零依赖）

**设计原则**: 仅用浏览器原生 API，不依赖任何框架

**能力**:
- DOM 元素扫描（querySelectorAll）
- 可见性判断（getBoundingClientRect + getComputedStyle）
- 层级路径生成（parentElement 遍历）
- 文本内容提取（textContent）
- 基础属性收集（tagName、className、id）

**为什么这样设计**:
- 浏览器 API 100% 稳定
- 任何网页都能使用
- 即使 React/Vue/Angular 升级也不受影响

**如果失败会怎样**:
- 理论上不会失败（除非浏览器 API 变更）
- 极端情况：页面无可见元素 → 显示"未找到可交互元素"

#### Level 2: 增强层（推荐配置）

**设计原则**: 开发者主动添加标记，系统识别利用

**推荐标记**:
```html
<!-- 方式1: AI 专用标记 -->
<button data-ai-id="submit-order">提交订单</button>

<!-- 方式2: 组件名标记 -->
<div data-component="OrderForm">
  <button data-ai-id="submit">提交</button>
</div>

<!-- 方式3: 复用现有测试标记 -->
<button data-testid="submit-button">提交</button>
```

**为什么这样设计**:
- 开发者最了解自己的代码
- 显式标记比隐式推断更可靠
- 不强制，渐进增强

**如果失败会怎样**:
- 无标记 → 降级到 Level 1，功能仍可用
- 标记不规范 → 忽略该标记，不影响其他功能

#### Level 3: 高级层（不稳定， opportunistic）

**设计原则**:  opportunistic（有机会就收集，不强求）

**能力**:
- 检测 React 是否存在（检查 window.React）
- 尝试获取 Fiber（如果内部属性存在）
- 尝试获取组件名（如果可用）
- 尝试获取 Props（如果可访问）

**为什么不依赖这些**:
- React 内部属性随时可能变更
- 生产模式通常被压缩/优化
- 不同构建工具行为不一致

**如果失败会怎样**:
- 完全不影响 Level 1/2
- 输出中 React 相关字段为 null
- 系统静默处理，不报错

---

## 3. 系统架构 v2.0

### 3.1 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │    Label    │  │   Hover     │  │    Input Dialog     │ │
│  │  Renderer   │  │  Highlight  │  │   (Modal)           │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
│         └────────────────┴─────────────────────┘            │
│                          │                                  │
├──────────────────────────┼──────────────────────────────────┤
│                     Core Engine                             │
├──────────────────────────┼──────────────────────────────────┤
│  ┌───────────────────────┴───────────────────────┐          │
│  │           UIMarker (Controller)               │          │
│  └───────────────────────┬───────────────────────┘          │
│         ┌────────────────┼────────────────┐                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Element   │  │  Context    │  │   Clue      │         │
│  │   Scanner   │  │  Collector  │  │  Generator  │         │
│  │  (Level 1)  │  │  (L1 + L2)  │  │  (Output)   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                 │
├─────────┼────────────────┼────────────────┼─────────────────┤
│         │     Optional Enhancement Layer  │                 │
├─────────┼────────────────┼────────────────┼─────────────────┤
│  ┌──────▼──────┐  ┌──────▼──────┐                         │
│  │  React      │  │  data-*     │                         │
│  │  Detector   │  │  Parser     │                         │
│  │  (Level 3)  │  │  (Level 2)  │                         │
│  └─────────────┘  └─────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 模块职责

| 模块 | 层级 | 职责 | 失败影响 |
|------|------|------|----------|
| ElementScanner | L1 | 扫描可交互 DOM 元素 | 系统无法工作（理论上不会失败） |
| ContextCollector | L1+L2 | 收集元素上下文信息 | 输出信息减少，但不中断 |
| ClueGenerator | L1 | 生成 AI 定位线索 | 输出简化，但仍可用 |
| ReactDetector | L3 | 尝试获取 React 信息 | 无影响，Level 1/2 继续工作 |
| data-* Parser | L2 | 解析开发者标记 | 无标记时忽略 |

---

## 4. 核心模块详细设计

### 4.1 ElementScanner（元素扫描器）

**目标**: 找到页面上所有可交互元素

**算法 v2.0（简化版）**:

```javascript
function scan(root = document.body) {
  // 1. 基础选择器（不依赖框架）
  const selector = `
    button:not([disabled]),
    input:not([type="hidden"]),
    select,
    textarea,
    a[href],
    [role="button"],
    [role="link"],
    [role="input"],
    [data-ai-id],
    [data-component],
    [data-testid],
    .clickable
  `;
  
  const elements = Array.from(root.querySelectorAll(selector));
  
  // 2. 可见性过滤
  return elements.filter(el => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    
    return rect.width > 0 
      && rect.height > 0
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && style.opacity !== '0';
  });
}
```

**与 v1.0 的区别**:
- ❌ 不再尝试获取 Fiber
- ❌ 不再计算"优先级分数"
- ✅ 纯 DOM 操作，100% 稳定

**失败策略**:
- 如果 `querySelectorAll` 失败（理论上不可能）→ 显示错误提示
- 如果页面无可见元素 → 显示"未找到可交互元素"

### 4.2 ContextCollector（上下文收集器）

**目标**: 为选中的元素收集多维上下文信息

**输出结构 v2.0**:

```typescript
interface ElementContext {
  // === Level 1: 基础信息（必须有）===
  dom: {
    tag: string;                    // "button"
    id: string | null;              // "submit-btn"
    className: string;              // "btn btn-primary"
    text: string;                   // "提交订单"（截断前 100 字符）
    attributes: Record<string, string>; // 所有 data-* 属性
  };
  
  path: {
    // DOM 层级路径（限制深度 10）
    segments: Array<{
      tag: string;
      index: number;                // 同 tag 中的索引
      className?: string;
    }>;
    // 简化路径描述
    description: string;            // "body > div.main > form > button"
  };
  
  geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
    viewport: { width: number; height: number; };
  };
  
  neighbors: {
    // 附近文本（用于定位上下文）
    precedingText: string;          // 前面元素的文本
    followingText: string;          // 后面元素的文本
    // 同层兄弟
    siblings: Array<{
      tag: string;
      text: string;
      isTarget: boolean;
    }>;
  };
  
  // === Level 2: 增强信息（如果有）===
  markers?: {
    aiId?: string;                  // data-ai-id
    component?: string;             // data-component
    testId?: string;                // data-testid
  };
  
  // === Level 3: React 信息（ opportunistic ）===
  react?: {
    componentName?: string;         // 组件名（如果能获取）
    props?: Record<string, any>;    // Props（如果能获取）
    fiberAvailable?: boolean;       // 是否检测到 Fiber
  };
}
```

**设计原则**: 信息冗余 > 精确性

- 不追求单一精确标识
- 提供多个线索让 AI 交叉验证
- 即使部分信息缺失，其他信息仍可定位

**为什么这样设计**:

AI 可以通过以下任一方式定位代码：
1. `data-ai-id="submit-order"` → 全局搜索
2. 文本 "提交订单" + 路径 "form > button" → 文件+行定位
3. className "btn-primary" + 邻近文本 → 组件推断
4. React 组件名 "SubmitButton" → 直接定位

**失败策略**:

| 信息类型 | 失败情况 | 处理 |
|----------|----------|------|
| DOM 信息 | 无 | 系统无法工作 |
| Path | 层级太深 | 截断到 10 层 |
| Neighbors | 无兄弟元素 | 返回空数组 |
| Markers | 无 data-* | 字段为 undefined |
| React | Fiber 不可用 | fiberAvailable: false |

### 4.3 ClueGenerator（线索生成器）

**目标**: 将 ElementContext 转换为 AI 友好的"定位线索"

**v2.0 重大变化**: 不再尝试"精确源码定位"，改为"提供搜索线索"

**输出结构**:

```typescript
interface LocationClues {
  // 高置信度线索（直接可用）
  highConfidence: {
    aiId?: string;                  // data-ai-id 值
    testId?: string;                // data-testid 值
    componentName?: string;         // React 组件名（如果 L3 成功）
  };
  
  // 中置信度线索（需要验证）
  mediumConfidence: {
    possibleFileNames: string[];    // 推断的文件名
    classNamePatterns: string[];    // CSS 类名模式
    textKeywords: string[];         // 文本关键词
  };
  
  // 辅助线索（增加上下文）
  context: {
    pageContext: string;            // "这是一个订单提交页面"
    elementRole: string;            // "这是一个提交按钮"
    surroundingText: string;        // 周围文本摘要
  };
  
  // 搜索建议（给 AI 的具体指令）
  searchStrategy: {
    // 推荐的搜索顺序
    steps: Array<{
      type: 'exact' | 'fuzzy' | 'content';
      query: string;
      reason: string;
    }>;
  };
}
```

**生成逻辑示例**:

```javascript
function generateClues(context) {
  const clues = {
    highConfidence: {},
    mediumConfidence: {
      possibleFileNames: [],
      classNamePatterns: [],
      textKeywords: []
    },
    context: {},
    searchStrategy: { steps: [] }
  };
  
  // 1. 高置信度线索
  if (context.markers?.aiId) {
    clues.highConfidence.aiId = context.markers.aiId;
    clues.searchStrategy.steps.push({
      type: 'exact',
      query: `data-ai-id="${context.markers.aiId}"`,
      reason: '开发者显式标记，最可靠'
    });
  }
  
  if (context.react?.componentName) {
    clues.highConfidence.componentName = context.react.componentName;
    clues.searchStrategy.steps.push({
      type: 'exact',
      query: `component ${context.react.componentName}`,
      reason: 'React 组件名直接对应文件'
    });
  }
  
  // 2. 中置信度：推断文件名
  const text = context.dom.text;
  if (text.includes('订单')) {
    clues.mediumConfidence.possibleFileNames.push(
      'Order.tsx',
      'OrderForm.tsx',
      'OrderSubmit.tsx'
    );
  }
  
  // 3. 辅助线索
  clues.context.elementRole = inferRole(context.dom.tag);
  
  return clues;
}
```

**与 v1.0 CodeResolver 的区别**:

| v1.0 | v2.0 |
|------|------|
| 尝试精确定位到文件:行号 | 提供多个可能文件 |
| 依赖 source map | 依赖文件名推断和文本搜索 |
| 失败时系统不可用 | 失败时仍有搜索线索 |
| 单一精确路径 | 多线索 + 搜索策略 |

**为什么这样设计**:

- AI 代码搜索能力越来越强（如 Cursor、Copilot）
- 提供关键词比提供精确位置更灵活
- 代码位置会随修改变化，搜索策略更鲁棒

### 4.4 ReactDetector（React 检测器）

**目标**: opportunistic 地获取 React 信息

**设计原则**:
- 检测到更好，检测不到无所谓
- 绝不因为获取 React 信息而阻塞主流程
- 所有操作包裹 try-catch

**检测逻辑**:

```javascript
function detectReact(element) {
  const result = {
    fiberAvailable: false,
    componentName: null,
    props: null
  };
  
  try {
    // 尝试获取 Fiber（不依赖特定属性名）
    const fiber = findFiber(element);
    if (!fiber) return result;
    
    result.fiberAvailable = true;
    
    // 尝试获取组件名
    if (fiber.type) {
      result.componentName = fiber.type.displayName || 
                            fiber.type.name || 
                            null;
    }
    
    // 尝试获取 Props（谨慎处理，可能很大）
    if (fiber.memoizedProps) {
      result.props = sanitizeProps(fiber.memoizedProps);
    }
  } catch (e) {
    // 静默失败
  }
  
  return result;
}

// 不依赖具体属性名，尝试多种可能
function findFiber(element) {
  const keys = Object.keys(element);
  
  // 尝试各种可能的 Fiber 属性名
  const fiberKey = keys.find(k => 
    k.startsWith('__reactFiber') || 
    k.startsWith('__reactInternal')
  );
  
  if (fiberKey) {
    return element[fiberKey];
  }
  
  // 尝试通过 DOM 遍历找到有 Fiber 的父元素
  let current = element;
  for (let i = 0; i < 5 && current; i++) {
    const parentKeys = Object.keys(current);
    const parentFiberKey = parentKeys.find(k => 
      k.startsWith('__reactFiber') || 
      k.startsWith('__reactInternal')
    );
    if (parentFiberKey) {
      return current[parentFiberKey];
    }
    current = current.parentElement;
  }
  
  return null;
}
```

**失败策略**:
- 任何异常 → 返回 `fiberAvailable: false`
- 不抛出错误，不打断流程
- 上层模块完全不依赖此结果

---

## 5. 推荐标记规范（Level 2）

### 5.1 标记类型

虽然 Level 2 是可选的，但强烈建议开发者使用以下标记：

#### 方式 1: data-ai-id（推荐）

```html
<button data-ai-id="submit-order">提交订单</button>
<input data-ai-id="order-email" type="email" />
```

**优点**:
- 语义明确，专为 AI 设计
- 全局唯一，精确定位
- 不依赖类名（类名经常变化）

**命名规范**:
```
格式: [模块]-[动作] 或 [模块]-[字段]

示例:
- submit-order          ✓
- order-email-input     ✓
- order-email           ✓（简洁）
- btn1                  ✗（无意义）
- submit                ✗（太泛）
```

#### 方式 2: data-component（组件级）

```html
<div data-component="OrderForm">
  <button data-ai-id="submit">提交</button>
</div>
```

**用途**:
- 帮助 AI 理解组件边界
- 缩小搜索范围

#### 方式 3: 复用现有测试标记

```html
<button data-testid="submit-button">提交</button>
<button data-cy="order-submit">提交</button>
```

**优点**:
- 不增加额外标记
- 测试和 AI 使用同一套标识

### 5.2 标记工具（可选）

提供 Babel/ESLint 插件，自动为组件添加标记：

```javascript
// 配置示例
{
  "plugins": [
    ["react-ui-marker/babel", {
      "addDataComponent": true,      // 自动添加 data-component
      "addDataAIId": "auto",          // 自动生成 data-ai-id
      "componentPattern": "**/*.tsx"  // 匹配文件
    }]
  ]
}
```

**自动生成示例**:

```tsx
// 输入
function SubmitButton() {
  return <button>提交</button>;
}

// 输出
function SubmitButton() {
  return <button data-component="SubmitButton" data-ai-id="submit-button">提交</button>;
}
```

---

## 6. 用户界面设计

### 6.1 标记渲染策略

**问题**: 标记太多会导致视觉混乱

**解决方案**:

```
1. 初始显示:
   - 只显示编号（小圆点）
   - 不显示组件名

2. 鼠标悬停:
   - 高亮元素
   - 显示信息卡片（编号 + 组件名 + data-ai-id）

3. 点击后:
   - 弹出输入对话框
```

**视觉设计**:

```css
/* 标记标签 */
.marker-label {
  position: fixed;
  background: #6366f1;
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483645;
}

/* 信息卡片（悬停显示） */
.marker-tooltip {
  position: fixed;
  background: #1f2937;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  max-width: 200px;
  z-index: 2147483646;
}
```

### 6.2 输入对话框

**设计目标**: 低干扰，快速输入

```
┌─────────────────────────────────────────┐
│  元素 [5] SubmitButton          [×]     │
├─────────────────────────────────────────┤
│  描述你的修改需求：                      │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 把按钮改成红色，文字改成"保存"   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [快捷选项]                              │
│  [改颜色] [改文字] [改位置]             │
│                                         │
│        [取消]          [发送给 AI]      │
└─────────────────────────────────────────┘
```

**快捷选项**: 预设常见修改类型，减少输入

---

## 7. 输出格式规范（v2.0）

### 7.1 完整输出示例

```json
{
  "version": "2.0",
  "timestamp": "2025-04-17T10:30:00.000Z",
  
  "selection": {
    "markerId": "marker-5",
    "markerLabel": "5"
  },
  
  "context": {
    "dom": {
      "tag": "button",
      "id": null,
      "className": "btn btn-primary submit-btn",
      "text": "提交订单",
      "attributes": {
        "data-ai-id": "submit-order",
        "type": "button"
      }
    },
    "path": {
      "segments": [
        { "tag": "body", "index": 0 },
        { "tag": "div", "index": 2, "className": "main" },
        { "tag": "form", "index": 0, "className": "order-form" },
        { "tag": "button", "index": 1 }
      ],
      "description": "body > div.main > form.order-form > button"
    },
    "geometry": {
      "x": 520,
      "y": 380,
      "width": 120,
      "height": 40,
      "viewport": { "width": 1440, "height": 900 }
    },
    "neighbors": {
      "precedingText": "订单金额: ¥299.00",
      "followingText": "",
      "siblings": [
        { "tag": "button", "text": "取消", "isTarget": false },
        { "tag": "button", "text": "提交订单", "isTarget": true }
      ]
    },
    "markers": {
      "aiId": "submit-order",
      "component": "OrderForm"
    },
    "react": {
      "componentName": "SubmitButton",
      "props": { "variant": "primary", "children": "提交订单" },
      "fiberAvailable": true
    }
  },
  
  "clues": {
    "highConfidence": {
      "aiId": "submit-order",
      "componentName": "SubmitButton"
    },
    "mediumConfidence": {
      "possibleFileNames": [
        "SubmitButton.tsx",
        "OrderForm.tsx",
        "buttons/Submit.tsx"
      ],
      "classNamePatterns": ["btn-primary", "submit-btn"],
      "textKeywords": ["提交订单", "submit", "order"]
    },
    "context": {
      "pageContext": "这是一个订单提交页面，包含订单金额和提交按钮",
      "elementRole": "这是一个表单提交按钮",
      "surroundingText": "订单金额: ¥299.00 [提交订单]"
    },
    "searchStrategy": {
      "steps": [
        {
          "type": "exact",
          "query": "data-ai-id=\"submit-order\"",
          "reason": "开发者显式标记，最可靠"
        },
        {
          "type": "exact",
          "query": "component SubmitButton",
          "reason": "React 组件名直接对应文件"
        },
        {
          "type": "fuzzy",
          "query": "提交订单 button primary",
          "reason": "通过文本和样式类搜索"
        },
        {
          "type": "content",
          "query": "btn-primary submit-btn",
          "reason": "通过 CSS 类名搜索"
        }
      ]
    }
  },
  
  "instruction": "把按钮改成红色，文字改成\"立即购买\"",
  "suggestedChanges": null
}
```

### 7.2 最小输出示例（降级情况）

当 Level 2/3 都不可用时：

```json
{
  "version": "2.0",
  "context": {
    "dom": {
      "tag": "button",
      "className": "btn-primary",
      "text": "提交"
    },
    "path": {
      "description": "body > div > div > button"
    },
    "neighbors": {
      "siblings": []
    }
  },
  "clues": {
    "highConfidence": {},
    "mediumConfidence": {
      "textKeywords": ["提交"],
      "classNamePatterns": ["btn-primary"]
    },
    "searchStrategy": {
      "steps": [
        {
          "type": "fuzzy",
          "query": "提交 button",
          "reason": "通过文本搜索按钮组件"
        }
      ]
    }
  },
  "instruction": "改成红色"
}
```

**说明**: 即使没有 Level 2/3，仍可通过"提交"+"button"定位代码。

---

## 8. 集成指南 v2.0

### 8.1 快速开始（零配置）

```html
<!DOCTYPE html>
<html>
<body>
  <div id="root"></div>
  
  <!-- 仅开发环境加载 -->
  <script>
    if (location.hostname === 'localhost') {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/react-ui-marker@2/dist/auto.global.js';
      script.onload = () => {
        // 自动初始化，Ctrl+Shift+M 激活
        window.UIMarker.init();
      };
      document.head.appendChild(script);
    }
  </script>
</body>
</html>
```

**效果**:
- 无需修改应用代码
- 无需配置
- 基础功能（Level 1）立即可用

### 8.2 渐进增强（推荐）

添加标记提升精度：

```tsx
// 手动标记关键元素
function OrderForm() {
  return (
    <form data-component="OrderForm">
      <input data-ai-id="order-email" type="email" />
      <button data-ai-id="submit-order" type="submit">
        提交订单
      </button>
    </form>
  );
}
```

**收益**:
- Level 2 激活
- AI 定位精度大幅提升
- 搜索从"模糊匹配"变为"精确查找"

### 8.3 自定义配置

```typescript
import { UIMarker } from 'react-ui-marker';

const marker = new UIMarker({
  // 快捷键
  shortcut: 'Ctrl+Shift+M',
  
  // 自定义选择器（扩展可标记元素）
  customSelectors: ['.my-button', '[data-action]'],
  
  // 提交回调
  onSubmit: (payload) => {
    sendToAI(payload);
  },
  
  // 自定义线索生成
  clueGenerator: (context) => {
    // 添加项目特定的线索
    return {
      ...defaultClues(context),
      projectHints: {
        module: inferModuleFromPath(context.path)
      }
    };
  }
});

// 程序化控制
marker.activate();
marker.deactivate();
```

---

## 9. 稳定性保障

### 9.1 错误边界设计

每个模块都有错误边界：

```typescript
class SafeModule {
  execute() {
    try {
      return this.doExecute();
    } catch (e) {
      // 记录但不抛出
      console.warn('[UIMarker] 模块降级:', e.message);
      return this.fallback();
    }
  }
}
```

### 9.2 运行时检测

```typescript
function checkEnvironment() {
  const checks = {
    // 必须通过的检查
    required: {
      'DOM API': typeof document !== 'undefined',
      'querySelector': !!document.querySelector,
    },
    // 可选的检查
    optional: {
      'React': typeof window.React !== 'undefined',
      'DevTools Hook': !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
    }
  };
  
  // 如果有 required 失败，系统不启动
  // 如果 optional 失败，静默降级
}
```

### 9.3 版本兼容性矩阵

| 环境 | 支持级别 | 说明 |
|------|----------|------|
| Chrome 80+ | ✅ 完全支持 | Level 1/2/3 |
| Firefox 75+ | ✅ 完全支持 | Level 1/2/3 |
| Safari 13+ | ✅ 完全支持 | Level 1/2/3 |
| React 16.8+ | ✅ Level 1+2 | Level 3 需测试 |
| React 18+ | ✅ 完全支持 | Level 1/2/3 |
| Vue 3 | ✅ Level 1+2 | 无 Level 3 |
| 原生 HTML | ✅ Level 1+2 | 无 Level 3 |

---

## 10. 实现代码（核心）

### 10.1 完整简化实现

```typescript
// ui-marker-core.ts
// v2.0 简化版实现

// ============================================
// 类型定义
// ============================================

interface Marker {
  id: string;
  label: string;
  element: HTMLElement;
  rect: DOMRect;
}

interface ElementContext {
  dom: {
    tag: string;
    id: string | null;
    className: string;
    text: string;
    attributes: Record<string, string>;
  };
  path: {
    segments: Array<{ tag: string; index: number; className?: string }>;
    description: string;
  };
  geometry: { x: number; y: number; width: number; height: number };
  neighbors: {
    precedingText: string;
    followingText: string;
    siblings: Array<{ tag: string; text: string; isTarget: boolean }>;
  };
  markers?: { aiId?: string; component?: string; testId?: string };
  react?: { componentName?: string; props?: any; fiberAvailable: boolean };
}

interface SelectionPayload {
  version: string;
  timestamp: string;
  selection: { markerId: string; markerLabel: string };
  context: ElementContext;
  clues: LocationClues;
  instruction: string;
}

// ============================================
// Level 1: 核心模块（100% 稳定）
// ============================================

class ElementScanner {
  private selector = `
    button:not([disabled]), input:not([type="hidden"]), select, textarea,
    a[href], [role="button"], [role="link"], [data-ai-id], [data-component]
  `;
  
  scan(): Marker[] {
    const elements = Array.from(document.querySelectorAll(this.selector));
    
    return elements
      .filter(el => this.isVisible(el as HTMLElement))
      .map((el, index) => ({
        id: `marker-${index}`,
        label: (index + 1).toString(),
        element: el as HTMLElement,
        rect: el.getBoundingClientRect()
      }));
  }
  
  private isVisible(el: HTMLElement): boolean {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 
      && style.display !== 'none' 
      && style.visibility !== 'hidden';
  }
}

class ContextCollector {
  collect(marker: Marker): ElementContext {
    const el = marker.element;
    
    return {
      dom: this.collectDOM(el),
      path: this.collectPath(el),
      geometry: this.collectGeometry(marker),
      neighbors: this.collectNeighbors(el, marker),
      markers: this.collectMarkers(el),
      react: this.tryCollectReact(el) // Level 3, opportunistic
    };
  }
  
  private collectDOM(el: HTMLElement): ElementContext['dom'] {
    const attrs: Record<string, string> = {};
    for (const attr of el.attributes) {
      if (attr.name.startsWith('data-')) {
        attrs[attr.name] = attr.value;
      }
    }
    
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      className: el.className || '',
      text: (el.textContent || '').slice(0, 100),
      attributes: attrs
    };
  }
  
  private collectPath(el: HTMLElement): ElementContext['path'] {
    const segments: ElementContext['path']['segments'] = [];
    let current: HTMLElement | null = el;
    let depth = 0;
    
    while (current && current !== document.body && depth < 10) {
      const parent = current.parentElement;
      if (!parent) break;
      
      const siblings = Array.from(parent.children).filter(
        c => c.tagName === current!.tagName
      );
      const index = siblings.indexOf(current);
      
      segments.unshift({
        tag: current.tagName.toLowerCase(),
        index,
        className: current.className || undefined
      });
      
      current = parent;
      depth++;
    }
    
    // 添加 body
    segments.unshift({ tag: 'body', index: 0 });
    
    return {
      segments,
      description: segments.map(s => 
        s.className ? `${s.tag}.${s.className.split(' ')[0]}` : s.tag
      ).join(' > ')
    };
  }
  
  private collectGeometry(marker: Marker): ElementContext['geometry'] {
    return {
      x: marker.rect.x,
      y: marker.rect.y,
      width: marker.rect.width,
      height: marker.rect.height
    };
  }
  
  private collectNeighbors(el: HTMLElement, marker: Marker): ElementContext['neighbors'] {
    const parent = el.parentElement;
    const siblings = parent 
      ? Array.from(parent.children).map(c => ({
          tag: c.tagName.toLowerCase(),
          text: (c.textContent || '').slice(0, 50),
          isTarget: c === el
        }))
      : [];
    
    return {
      precedingText: this.getAdjacentText(el, 'previous'),
      followingText: this.getAdjacentText(el, 'next'),
      siblings
    };
  }
  
  private getAdjacentText(el: HTMLElement, direction: 'previous' | 'next'): string {
    const sibling = direction === 'previous' 
      ? el.previousElementSibling 
      : el.nextElementSibling;
    return sibling ? (sibling.textContent || '').slice(0, 100) : '';
  }
  
  private collectMarkers(el: HTMLElement): ElementContext['markers'] {
    return {
      aiId: el.dataset.aiId,
      component: el.dataset.component,
      testId: el.dataset.testid || el.dataset.cy
    };
  }
  
  // Level 3: opportunistic React 检测
  private tryCollectReact(el: HTMLElement): ElementContext['react'] {
    const result: ElementContext['react'] = { fiberAvailable: false };
    
    try {
      // 尝试找 Fiber 属性
      const fiberKey = Object.keys(el).find(k => 
        k.startsWith('__reactFiber') || k.startsWith('__reactInternal')
      );
      
      if (!fiberKey) return result;
      
      const fiber = (el as any)[fiberKey];
      if (!fiber) return result;
      
      result.fiberAvailable = true;
      
      // 向上找组件名
      let current = fiber;
      while (current) {
        if (current.type && (current.type.displayName || current.type.name)) {
          result.componentName = current.type.displayName || current.type.name;
          break;
        }
        current = current.return;
      }
      
      // 尝试获取 Props
      if (fiber.memoizedProps) {
        result.props = this.sanitizeProps(fiber.memoizedProps);
      }
    } catch {
      // 静默失败
    }
    
    return result;
  }
  
  private sanitizeProps(props: any): any {
    const result: any = {};
    for (const key of Object.keys(props).slice(0, 10)) {
      const val = props[key];
      if (typeof val === 'function') {
        result[key] = '[Function]';
      } else if (typeof val === 'object' && val !== null) {
        result[key] = '[Object]';
      } else {
        result[key] = val;
      }
    }
    return result;
  }
}

class ClueGenerator {
  generate(context: ElementContext) {
    return {
      highConfidence: this.getHighConfidence(context),
      mediumConfidence: this.getMediumConfidence(context),
      context: this.getContext(context),
      searchStrategy: this.getSearchStrategy(context)
    };
  }
  
  private getHighConfidence(context: ElementContext) {
    const clues: any = {};
    if (context.markers?.aiId) clues.aiId = context.markers.aiId;
    if (context.markers?.testId) clues.testId = context.markers.testId;
    if (context.react?.componentName) clues.componentName = context.react.componentName;
    return clues;
  }
  
  private getMediumConfidence(context: ElementContext) {
    const text = context.dom.text;
    return {
      possibleFileNames: this.inferFileNames(text, context.dom.className),
      classNamePatterns: context.dom.className.split(' ').filter(Boolean),
      textKeywords: text.split(/\s+/).slice(0, 5)
    };
  }
  
  private inferFileNames(text: string, className: string): string[] {
    const names: string[] = [];
    
    // 从文本推断
    if (text.includes('订单')) names.push('Order.tsx', 'OrderForm.tsx');
    if (text.includes('用户')) names.push('User.tsx', 'UserProfile.tsx');
    
    // 从类名推断
    const classParts = className.split('-');
    if (classParts.length > 1) {
      names.push(`${this.capitalize(classParts[0])}.tsx`);
    }
    
    return [...new Set(names)];
  }
  
  private capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  
  private getContext(context: ElementContext) {
    return {
      pageContext: `页面包含 ${context.path.segments[0]?.tag || 'body'}`,
      elementRole: `这是一个${context.dom.tag}元素`,
      surroundingText: `${context.neighbors.precedingText.slice(0, 50)} [${context.dom.text}] ${context.neighbors.followingText.slice(0, 50)}`
    };
  }
  
  private getSearchStrategy(context: ElementContext) {
    const steps: any[] = [];
    
    if (context.markers?.aiId) {
      steps.push({
        type: 'exact',
        query: `data-ai-id="${context.markers.aiId}"`,
        reason: '开发者显式标记'
      });
    }
    
    if (context.react?.componentName) {
      steps.push({
        type: 'exact',
        query: `component ${context.react.componentName}`,
        reason: 'React 组件名'
      });
    }
    
    steps.push({
      type: 'fuzzy',
      query: `${context.dom.text} ${context.dom.tag}`,
      reason: '文本 + 标签搜索'
    });
    
    return { steps };
  }
}

// ============================================
// UI 组件
// ============================================

class UIRenderer {
  private labels: HTMLElement[] = [];
  private overlay: HTMLElement;
  private tooltip: HTMLElement;
  
  constructor() {
    this.overlay = this.createElement('div', {
      position: 'fixed',
      border: '2px solid #6366f1',
      background: 'rgba(99, 102, 241, 0.1)',
      borderRadius: '4px',
      pointerEvents: 'none',
      zIndex: '2147483646',
      display: 'none'
    });
    
    this.tooltip = this.createElement('div', {
      position: 'fixed',
      background: '#1f2937',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '12px',
      zIndex: '2147483647',
      pointerEvents: 'none',
      display: 'none',
      maxWidth: '200px'
    });
  }
  
  private createElement(tag: string, styles: Record<string, string>) {
    const el = document.createElement(tag);
    Object.assign(el.style, styles);
    return el;
  }
  
  renderLabels(markers: Marker[]) {
    this.clearLabels();
    
    markers.forEach(m => {
      const label = this.createElement('div', {
        position: 'fixed',
        top: `${m.rect.top + window.scrollY - 10}px`,
        left: `${m.rect.left + window.scrollX}px`,
        background: '#6366f1',
        color: 'white',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        fontSize: '11px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '2147483645',
        pointerEvents: 'none'
      });
      label.textContent = m.label;
      document.body.appendChild(label);
      this.labels.push(label);
    });
    
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.tooltip);
  }
  
  showHover(marker: Marker, context: ElementContext) {
    const { rect } = marker;
    
    Object.assign(this.overlay.style, {
      display: 'block',
      top: `${rect.top + window.scrollY}px`,
      left: `${rect.left + window.scrollX}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    });
    
    const info = [
      `[${marker.label}] ${context.dom.tag}`,
      context.markers?.aiId && `ID: ${context.markers.aiId}`,
      context.react?.componentName && `组件: ${context.react.componentName}`,
      context.dom.text && `文本: ${context.dom.text.slice(0, 30)}`
    ].filter(Boolean).join('\n');
    
    Object.assign(this.tooltip.style, {
      display: 'block',
      top: `${rect.top + window.scrollY - 60}px`,
      left: `${rect.left + window.scrollX}px`,
      whiteSpace: 'pre-line'
    });
    this.tooltip.textContent = info;
  }
  
  hideHover() {
    this.overlay.style.display = 'none';
    this.tooltip.style.display = 'none';
  }
  
  clearLabels() {
    this.labels.forEach(l => l.remove());
    this.labels = [];
    this.overlay.remove();
    this.tooltip.remove();
  }
}

// ============================================
// 主控制器
// ============================================

export class UIMarker {
  private scanner: ElementScanner;
  private collector: ContextCollector;
  private clueGen: ClueGenerator;
  private renderer: UIRenderer;
  private markers: Marker[] = [];
  private isActive = false;
  private onSubmit?: (payload: SelectionPayload) => void;
  
  constructor(options?: { onSubmit?: (payload: SelectionPayload) => void }) {
    this.scanner = new ElementScanner();
    this.collector = new ContextCollector();
    this.clueGen = new ClueGenerator();
    this.renderer = new UIRenderer();
    this.onSubmit = options?.onSubmit;
    
    this.bindEvents();
  }
  
  private bindEvents() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        this.toggle();
      }
    });
  }
  
  activate() {
    if (this.isActive) return;
    this.isActive = true;
    
    this.markers = this.scanner.scan();
    this.renderer.renderLabels(this.markers);
    
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick, true);
  }
  
  deactivate() {
    this.isActive = false;
    this.renderer.clearLabels();
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleClick, true);
  }
  
  toggle() {
    this.isActive ? this.deactivate() : this.activate();
  }
  
  private handleMouseMove = (e: MouseEvent) => {
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target) {
      this.renderer.hideHover();
      return;
    }
    
    const marker = this.findMarker(target as HTMLElement);
    if (marker) {
      const context = this.collector.collect(marker);
      this.renderer.showHover(marker, context);
    } else {
      this.renderer.hideHover();
    }
  };
  
  private handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const marker = this.findMarker(target);
    
    if (marker) {
      e.preventDefault();
      e.stopPropagation();
      this.handleSelect(marker);
    }
  };
  
  private findMarker(el: HTMLElement): Marker | null {
    return this.markers.find(m => m.element === el || m.element.contains(el)) || null;
  }
  
  private handleSelect(marker: Marker) {
    const context = this.collector.collect(marker);
    const clues = this.clueGen.generate(context);
    
    const instruction = prompt(`描述对 [${marker.label}] 的修改:`);
    if (!instruction) return;
    
    const payload: SelectionPayload = {
      version: '2.0',
      timestamp: new Date().toISOString(),
      selection: { markerId: marker.id, markerLabel: marker.label },
      context,
      clues,
      instruction
    };
    
    if (this.onSubmit) {
      this.onSubmit(payload);
    }
    
    window.dispatchEvent(new CustomEvent('ui-marker:submit', { detail: payload }));
  }
}

// 自动初始化
if (typeof window !== 'undefined') {
  (window as any).UIMarker = UIMarker;
}

export default UIMarker;
```

---

## 11. 总结

### v2.0 核心变化

| 维度 | 变化 | 收益 |
|------|------|------|
| **依赖** | React Fiber → DOM API | 100% 稳定，框架无关 |
| **定位** | 精确源码 → 搜索线索 | 鲁棒性更强，支持 AI 搜索 |
| **架构** | 单层 → 三层（L1/L2/L3） | 优雅降级，核心功能永不失败 |
| **侵入性** | 深度集成 → 零侵入 | 不修改应用代码 |
| **输出** | 单一精确 → 多维线索 | AI 更容易理解 |

### 使用建议

1. **零配置起步**: 直接引入，Level 1 立即可用
2. **渐进增强**: 添加 `data-ai-id` 标记，提升到 Level 2
3. **享受红利**: 如果检测到 React，自动获得 Level 3 信息

### 一句话总结

> "不追求精确理解 React，而是给 AI 足够信息去理解 UI。"

---

## 附录 X: AI 开发任务清单（执行用）

如果你是 AI 开发者，请按照以下清单执行：

### Phase 1: 核心脚本开发

**目标**: 创建 `dist/ui-marker.js`

**要求**:
- [ ] 单文件，原生 JavaScript（ES6+）
- [ ] 无外部依赖（不引入 React/Vue 等）
- [ ] 所有 CSS 内嵌在 JS 中
- [ ] 所有 HTML 模板内嵌在 JS 中

**功能清单**:
- [ ] `ElementScanner` 类 - 扫描可见交互元素
- [ ] `ContextCollector` 类 - 收集 DOM 上下文
- [ ] `ClueGenerator` 类 - 生成搜索线索
- [ ] `UIRenderer` 类 - 渲染标记和 UI
- [ ] `UIMarker` 主类 - 协调各模块
- [ ] 快捷键绑定（Ctrl+Shift+M）
- [ ] 事件委托处理（hover、click）
- [ ] 输入对话框（prompt 或自定义 modal）

**输出格式**:
```javascript
// ui-marker.js
(function() {
  'use strict';
  
  // 所有代码在这里...
  
  class UIMarker {
    // ...
  }
  
  // 暴露到全局
  window.UIMarker = UIMarker;
})();
```

### Phase 2: Demo 页面开发

**目标**: 创建 `demo/demo.html`

**内容要求**:
- [ ] 引入 `../dist/ui-marker.js`
- [ ] **基础元素区**: 按钮、输入框、链接、选择框
- [ ] **表单区**: 完整表单，多个输入项
- [ ] **嵌套结构区**: 多层 div 嵌套的复杂结构
- [ ] **列表区**: 重复元素（如表格行、列表项）
- [ ] **使用说明**: 快捷键提示、操作步骤

**样式要求**:
- [ ] 美观但不复杂（可用 CDN 如 Tailwind）
- [ ] 展示各种常见的 UI 模式

### Phase 3: 测试页面开发

**目标**: 创建 `test/test.html`

**测试内容**:
- [ ] 扫描功能测试 - 验证正确识别可见元素
- [ ] 标记渲染测试 - 验证标记位置正确
- [ ] 交互测试 - 验证 hover、click 正常
- [ ] 输出格式测试 - 验证 payload 结构正确
- [ ] 边界测试 - 隐藏元素、动态内容

**形式**:
- [ ] 可视化测试（绿色=通过，红色=失败）
- [ ] 控制台输出测试结果

### Phase 4: 文档和整理

**目标**: 完善项目

- [ ] `README.md` - 使用说明、API 文档
- [ ] 代码注释 - 关键函数加注释
- [ ] 文件结构整理

### 验收标准

**功能验收**:
- [ ] 引入单个 JS 文件即可工作
- [ ] `Ctrl+Shift+M` 正常激活/停用
- [ ] 显示数字标记（小圆点样式）
- [ ] 鼠标悬停显示高亮 + 信息
- [ ] 点击弹出输入框（简洁样式）
- [ ] 提交后输出完整 payload

**质量验收**:
- [ ] 代码无报错
- [ ] 不污染全局命名空间（仅暴露 UIMarker）
- [ ] 不影响页面原有功能
- [ ] 内存无泄漏（可反复激活/停用）

**Demo 验收**:
- [ ] 打开 demo.html 即可测试
- [ ] 包含多种典型场景
- [ ] 有清晰的使用说明

### 开发提示

**推荐实现顺序**:

1. 先实现核心类结构（空方法）
2. 实现 ElementScanner（最容易验证）
3. 实现 UIRenderer 基础标记显示
4. 实现点击交互
5. 实现输入对话框
6. 完善 ContextCollector
7. 实现 ClueGenerator
8. 整合测试

**调试技巧**:

```javascript
// 在控制台手动测试
const marker = new UIMarker();
marker.activate();
marker.deactivate();

// 查看扫描结果
marker.markers.forEach(m => console.log(m.label, m.element));
```

**常见陷阱**:

- ⚠️ 标记位置要加上 `window.scrollX/Y`（处理滚动）
- ⚠️ 动态内容需要重新扫描
- ⚠️ z-index 要设置足够高（2147483647）
- ⚠️ 输入框要防止事件冒泡

---

**文档结束 - 请按上述清单开发**
