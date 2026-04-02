# 布局结构分析与重构方案

## 当前问题

### 1. 布局组件分散
```
components/layout/AppLayout/      # 主布局框架
components/layout/TopBar/         # 顶部栏
components/layout/BottomMenu/     # 底部菜单
features/sidebar/components/...   # 侧边栏（分散在功能域）
features/system/components/terminal/     # 底部面板之一
features/system/components/llm-log/      # 底部面板之二
```

### 2. 职责不清晰
- **TopBar 900+行**：包含 DirectoryPicker 组件定义，过于臃肿
- **AppLayout**：既负责布局框架，又包含聊天滚动逻辑和输入框
- **BottomPanel 没有统一目录**：分散在不同功能域

### 3. 目录结构不一致
| 组件 | 当前位置 | 结构类型 |
|------|----------|----------|
| Sidebar | features/sidebar/components/SidebarPanel/ | 功能域组织 |
| TopBar | components/layout/TopBar/ | 类型组织 |
| BottomMenu | components/layout/BottomMenu/ | 类型组织 |
| Terminal | features/system/components/terminal/ | 功能域组织 |

## 推荐方案：统一布局层

### 目标结构
```
app/layout/                       # 统一布局层
├── AppLayout/                    # 主布局框架（纯布局，无业务逻辑）
├── AppHeader/                    # 应用头部（简化版 TopBar）
├── AppFooter/                    # 应用底部（BottomMenu）
├── AppSidebar/                   # 侧边栏容器（从 features 迁移）
├── panels/                       # 面板组件
│   ├── BottomPanel/              # 底部面板容器
│   ├── TerminalPanel/            # 终端面板（从 system 迁移）
│   └── LlmLogPanel/              # LLM日志面板（从 system 迁移）
└── index.ts                      # 统一导出

features/sidebar/                 # 保留，但只包含内容组件
├── components/
│   ├── SidebarContent/           # 侧边栏内容（原 SidebarPanel）
│   ├── Sessions/
│   ├── Settings/
│   └── ...
```

### 职责划分

#### app/layout/AppLayout/
```typescript
// 纯布局框架，只负责布局结构
interface AppLayoutProps {
  header: React.ReactNode;      // 传入 AppHeader
  sidebar: React.ReactNode;     // 传入 SidebarContent
  main: React.ReactNode;        // 传入页面内容
  footer: React.ReactNode;      // 传入 AppFooter
  bottomPanel?: React.ReactNode; // 传入 BottomPanel
}
```

#### app/layout/AppHeader/
```typescript
// 简化版 TopBar，只负责导航和全局操作
interface AppHeaderProps {
  title?: React.ReactNode;
  actions?: React.ReactNode;    // 工作目录选择器等
  onOpenSystemPrompt: () => void;
  onOpenModelSelector: () => void;
}
```

#### app/layout/panels/BottomPanel/
```typescript
// 底部面板容器，可切换显示 Terminal 或 LLM Log
interface BottomPanelProps {
  activeTab: 'terminal' | 'llm-log';
  onClose: () => void;
  onChangeTab: (tab: 'terminal' | 'llm-log') => void;
}
```

## 重构步骤

### Step 1: 创建统一布局目录
```bash
mkdir -p app/layout/{AppLayout,AppHeader,AppFooter,AppSidebar,panels/{BottomPanel,TerminalPanel,LlmLogPanel}}
```

### Step 2: 迁移和拆分组件
1. **AppLayout** → 简化，移除业务逻辑
2. **TopBar** → 拆分为 AppHeader + DirectoryPicker组件
3. **BottomMenu** → 重命名为 AppFooter
4. **terminal/** → 迁移到 panels/TerminalPanel/
5. **llm-log/** → 迁移到 panels/LlmLogPanel/

### Step 3: 更新导入路径
- 所有页面统一从 `app/layout/` 导入布局组件
- Sidebar 内容仍从 `features/sidebar/` 导入

## 优势对比

### 当前方案的问题
- ❌ 布局组件分散在3个不同目录
- ❌ TopBar 过于臃肿
- ❌ AppLayout 包含业务逻辑
- ❌ 难以找到相关布局组件

### 新方案的优势
- ✅ 所有布局组件在一个目录
- ✅ 职责清晰：layout/ 负责框架，features/ 负责内容
- ✅ AppHeader 简化，复杂逻辑移到独立组件
- ✅ BottomPanel 统一管理
- ✅ 符合 Next.js App Router 布局模式

## 实施建议

推荐采用 **方案A：统一布局层**，因为：
1. 符合行业规范（Next.js、Remix 等框架都使用 app/layout/）
2. 职责边界清晰
3. 便于维护和查找
4. 支持未来扩展（如添加 LeftPanel、RightPanel 等）
