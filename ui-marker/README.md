# React UI Marker v2.0

一个浏览器端可视化选择器，帮助 AI 理解页面元素并进行精确修改。

> **设计哲学**: 不追求精确理解 React，而是给 AI 足够信息去理解 UI

## ✨ 特性

- **零依赖**: 原生 JavaScript (ES6+)，无需 React/Vue/Angular
- **即插即用**: 单个文件引入，无需配置
- **三层架构**: Level 1 (基础) + Level 2 (增强) + Level 3 (高级)
- **优雅降级**: 核心功能 100% 可用，增强功能按需生效
- **多维线索**: 提供丰富的上下文信息供 AI 定位代码

## 🚀 快速开始

### 方式一：直接引入 (推荐)

```html
<!DOCTYPE html>
<html>
<body>
  <!-- 你的应用内容 -->
  <div id="app">...</div>
  
  <!-- 仅开发环境加载 UI Marker -->
  <script>
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      const script = document.createElement('script');
      script.src = './ui-marker.js';
      document.body.appendChild(script);
    }
  </script>
</body>
</html>
```

### 方式二：NPM/CDN (未来支持)

```html
<!-- 通过 CDN 引入 -->
<script src="https://unpkg.com/react-ui-marker@2/dist/ui-marker.js"></script>
```

## 🎮 使用方法

1. **激活**: 按 `Ctrl + Shift + M` 快捷键
2. **选择**: 页面元素会显示蓝色数字标记
3. **悬停**: 鼠标悬停查看元素信息
4. **点击**: 点击目标元素弹出输入框
5. **描述**: 输入修改需求，发送给 AI

## 📁 项目结构

```
ui-marker/
├── dist/
│   └── ui-marker.js          # 核心脚本（单文件，自包含）
├── demo/
│   ├── demo.html             # 完整功能演示页面
│   └── simple.html           # 简单使用示例
├── test/
│   └── test.html             # 自动化测试页面
└── README.md                 # 本文件
```

## 🧪 演示和测试

- **[功能演示](./demo/demo.html)**: 完整的交互演示，包含各种 UI 元素
- **[测试页面](./test/test.html)**: 自动化测试套件，验证所有功能
- **[简单示例](./demo/simple.html)**: 最简使用示例

## 🏗️ 三层架构

### Level 1: 基础层 (100% 稳定)

- 纯 DOM API 操作
- 元素扫描和可见性判断
- 基础上下文收集 (标签、类名、文本、路径)
- **任何网页都能使用，零依赖**

### Level 2: 增强层 (推荐配置)

- 识别 `data-ai-id`、`data-component`、`data-testid` 等标记
- 开发者显式标记，提升 AI 定位精度
- **渐进增强，无标记时降级到 Level 1**

### Level 3: 高级层 (机会性获取)

- 尝试获取 React Fiber 信息 (如果存在)
- 组件名和 Props 收集
- **不保证可用，失败不影响其他层级**

## 🏷️ 推荐标记规范

### 最佳实践：使用 data-ai-id

```html
<!-- 为关键交互元素添加标记 -->
<button data-ai-id="submit-order">提交订单</button>
<input data-ai-id="user-email" type="email" placeholder="邮箱" />

<!-- 组件级标记 -->
<div data-component="OrderForm">
  <button data-ai-id="submit">提交</button>
  <button data-ai-id="cancel">取消</button>
</div>
```

### 复用现有标记

```html
<!-- 复用测试标记 -->
<button data-testid="save-button">保存</button>
<button data-cy="delete-button">删除</button>
```

### 命名规范

```
格式: [模块]-[动作] 或 [模块]-[字段]

推荐:
- submit-order
- user-email-input
- login-submit
- cart-checkout

不推荐:
- btn1 (无意义)
- submit (太泛)
- button (无信息)
```

## ⚙️ 高级配置

### 自定义实例

```javascript
// 创建自定义实例
const marker = new UIMarker({
  // 提交回调
  onSubmit: (payload) => {
    console.log('用户选择:', payload);
    // 发送给 AI 处理...
  },
  
  // 自定义快捷键 (默认: Ctrl+Shift+M)
  shortcut: 'Ctrl+Shift+M',
  
  // 自定义选择器
  customSelectors: ['.custom-button', '[data-action]']
});

// 手动控制
marker.activate();   // 激活
marker.deactivate(); // 停用
marker.toggle();     // 切换
```

### 事件监听

```javascript
// 监听提交事件
window.addEventListener('ui-marker:submit', (event) => {
  const payload = event.detail;
  console.log('提交的数据:', payload);
  
  // payload 结构:
  // {
  //   version: '2.0',
  //   timestamp: '...',
  //   selection: { markerId: '...', markerLabel: '...' },
  //   context: { ... },  // 元素上下文
  //   clues: { ... },     // AI 定位线索
  //   instruction: '...'  // 用户输入
  // }
});

// 监听状态变化
window.uiMarker.addEventListener('activate', () => {
  console.log('UI Marker 已激活');
});

window.uiMarker.addEventListener('deactivate', () => {
  console.log('UI Marker 已停用');
});
```

## 📊 输出格式

UI Marker 收集的信息包括：

### 基础信息 (Level 1)
- DOM 路径 (如: `body > div.main > form > button`)
- 元素标签、类名、ID、文本内容
- 几何位置和尺寸
- 相邻元素上下文

### 增强信息 (Level 2)
- `data-ai-id`、`data-component`、`data-testid` 等标记
- 语义化类名推断

### AI 线索 (Level 3)
- React 组件名 (如果可获取)
- 高置信度定位标识
- 搜索策略建议
- 可能对应的文件名

### 完整输出示例

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
      "className": "btn btn-primary",
      "text": "提交订单",
      "attributes": { "data-ai-id": "submit-order" }
    },
    "path": {
      "description": "body > div.main > form.order-form > button"
    },
    "geometry": { "x": 520, "y": 380, "width": 120, "height": 40 },
    "neighbors": {
      "precedingText": "订单金额: ¥299.00",
      "followingText": "",
      "siblings": []
    },
    "markers": {
      "aiId": "submit-order",
      "component": "OrderForm"
    }
  },
  "clues": {
    "highConfidence": {
      "aiId": "submit-order"
    },
    "mediumConfidence": {
      "possibleFileNames": ["OrderForm.tsx", "SubmitButton.tsx"],
      "classNamePatterns": ["btn-primary"],
      "textKeywords": ["提交订单", "submit", "order"]
    },
    "searchStrategy": {
      "steps": [
        {
          "type": "exact",
          "query": "data-ai-id=\"submit-order\"",
          "reason": "开发者显式标记"
        },
        {
          "type": "fuzzy",
          "query": "提交订单 button",
          "reason": "文本 + 标签搜索"
        }
      ]
    }
  },
  "instruction": "改成红色，文字改为'立即购买'"
}
```

## 🔧 开发指南

### 构建开发

```bash
# 项目基于原生 JavaScript，无需构建
# 直接编辑 src/ui-marker.js，然后复制到 dist/

# 开发时建议使用 live server 或类似的工具
# 打开 demo.html 进行测试
```

### 代码结构

```javascript
// 核心类
class UIMarker              // 主控制器
class ElementScanner        // 元素扫描器 (Level 1)
class ContextCollector      // 上下文收集器 (L1 + L2 + L3)
class ClueGenerator         // 线索生成器
class UIRenderer            // UI 渲染器

// 设计模式
// - 观察者模式: 事件驱动
// - 策略模式: 三层架构
// - 装饰器模式: 渐进增强
```

### 测试

```bash
# 打开 test/test.html 运行完整测试套件
# 测试包括:
# - 元素扫描和可见性判断
# - 标记渲染和位置计算
# - 交互响应和对话框
# - 数据收集和格式输出
# - 边界情况和错误处理
```

## 📱 浏览器兼容性

| 浏览器 | 支持级别 | 说明 |
|--------|----------|------|
| Chrome 80+ | ✅ 完全支持 | Level 1/2/3 |
| Firefox 75+ | ✅ 完全支持 | Level 1/2/3 |
| Safari 13+ | ✅ 完全支持 | Level 1/2/3 |
| Edge 80+ | ✅ 完全支持 | Level 1/2/3 |
| React 16.8+ | ✅ Level 1+2 | Level 3 需测试 |
| Vue 3 | ✅ Level 1+2 | 无 Level 3 |
| 原生 HTML | ✅ Level 1+2 | 无 Level 3 |

## 🚨 常见问题

### Q: 标记不显示或显示不正确？
1. 检查元素是否可见 (非 hidden、非 opacity: 0、有尺寸)
2. 检查元素是否可交互 (非 disabled)
3. 刷新页面后重试
4. 按 Ctrl+Shift+M 重新激活

### Q: 点击元素没反应？
1. 确认 UI Marker 已激活 (右上角状态显示)
2. 检查元素是否被其他元素遮挡
3. 尝试刷新页面

### Q: 如何自定义样式？
```css
/* 覆盖默认样式 */
.ui-marker-label {
  background: #ff0000 !important;
  color: white !important;
}
```

### Q: 如何与其他工具集成？
通过事件监听或回调函数：

```javascript
const marker = new UIMarker({
  onSubmit: (payload) => {
    // 发送给 AI 助手
    fetch('/api/ai/process', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
});
```

## 📄 许可证

MIT License

## 📖 相关文档

- [技术规格文档](../research/react-ui-marker-spec-v2.md) - 完整的设计文档和技术细节
- [演示页面](./demo/demo.html) - 交互式功能演示
- [测试页面](./test/test.html) - 自动化测试套件

## 🤝 贡献

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开 Pull Request

## 📞 支持

- 问题反馈: GitHub Issues
- 功能建议: GitHub Discussions
- 紧急问题: 直接修改代码并提交 PR

---

**一句话总结**: "给 AI 足够信息去理解 UI，而不是让 AI 精确理解 React。"