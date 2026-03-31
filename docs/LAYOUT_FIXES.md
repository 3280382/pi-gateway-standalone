# 布局修复总结

> **日期**: 2026-03-30  
> **状态**: 已修复  
> **构建状态**: ✅ 成功

---

## 修复的问题列表

### 1. BottomMenu 缺少 `position: fixed` ⚠️ 严重

**文件**: `src/client/components/layout/BottomMenu/BottomMenu.module.css`

**问题**: BottomMenu 没有 fixed 定位，导致它会随内容滚动而消失。

**修复**:
```css
.bottomMenu {
  position: fixed;  /* 添加 */
  bottom: 0;
  left: 0;
  right: 0;
  /* ... */
}
```

---

### 2. AppLayout 缺少 `position: relative` ⚠️ 严重

**文件**: `src/client/components/layout/AppLayout/AppLayout.module.css`

**问题**: 根布局容器没有 relative 定位，导致 absolute 子元素（sidebarOverlay, bottomPanel）相对于 viewport 定位，而不是相对于 layout 容器。

**修复**:
```css
.layout {
  position: relative;  /* 添加 */
  display: flex;
  flex-direction: column;
  /* ... */
}
```

---

### 3. SidebarOverlay 定位方式错误 ⚠️ 严重

**文件**: `src/client/components/layout/AppLayout/AppLayout.module.css`

**问题**: 使用 `position: absolute` 会导致 sidebar 在内容滚动时移动。

**修复**:
```css
.sidebarOverlay {
  position: fixed;  /* 从 absolute 改为 fixed */
  top: 64px;
  left: 0;
  bottom: 44px;
  /* ... */
  display: flex;           /* 添加 */
  flex-direction: column;  /* 添加 */
  overflow: hidden;        /* 添加 */
}
```

---

### 4. BottomPanel 定位方式错误

**文件**: `src/client/components/layout/AppLayout/AppLayout.module.css`

**问题**: 使用 `position: absolute` 会导致面板在内容滚动时移动。

**修复**:
```css
.bottomPanel {
  position: fixed;  /* 从 absolute 改为 fixed */
  left: 0;
  right: 0;
  bottom: 44px;
  /* ... */
}
```

---

### 5. global.css 中 .main 的冗余 padding-bottom

**文件**: `src/client/styles/global.css`

**问题**: `.main` 设置了 `padding-bottom: 44px`，但 BottomMenu 已经是 fixed 定位，不需要额外的 padding。

**修复**:
```css
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
  height: 100%;
  /* 删除 padding-bottom: 44px */
}
```

---

### 6. FileBrowser contentArea 冲突的 max-height

**文件**: `src/client/components/files/FileBrowser.module.css`

**问题**: `.contentArea` 同时设置了 `flex: 1` 和 `max-height: calc(100vh - 140px)`，这会造成布局冲突。

**修复**:
```css
.contentArea {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
  min-height: 0;
  /* 删除 max-height: calc(100vh - 140px) */
}
```

---

### 7. FileBrowser list/grid 冗余的 max-height

**文件**: `src/client/components/files/FileBrowser.module.css`

**问题**: `.list` 和 `.grid` 设置了 `max-height: calc(100vh - 200px)`，但父元素已经有 overflow 控制。

**修复**:
```css
.list {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 8px;
  min-height: 0;
  /* 删除 height: auto 和 max-height */
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 4px;
  padding: 8px;
  overflow-y: auto;
  min-height: 0;
  /* 删除 height: auto 和 max-height */
}
```

---

### 8. 删除 `!important` 使用

**文件**: `src/client/components/files/FileBrowser.module.css`

**问题**: 多处使用 `!important` 会破坏 CSS 的层叠规则。

**修复**: 删除以下地方的 `!important`:
- `.contentArea` 的 `overflow-y: auto !important`
- `.list` 的 `overflow-y: auto !important`
- `.grid` 的 `overflow-y: auto !important`

---

## 布局架构说明

修复后的布局层级结构：

```
┌─────────────────────────────────────────────────────┐
│ Header (64px, fixed)                                │  z-index: 100
├─────────────────────────────────────────────────────┤
│                                                     │
│  Body (flex: 1)                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │                                               │  │
│  │  Content (flex: 1)                            │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │ contentBody (flex: 1, overflow: auto)   │  │  │
│  │  │                                         │  │  │
│  │  │  [MessageList / FileBrowser]            │  │  │
│  │  │                                         │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │                                               │  │
│  │  inputArea (flex-shrink: 0)                   │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Footer (44px, fixed)                                │  z-index: 150
└─────────────────────────────────────────────────────┘

Overlay Elements:
┌─────────────────────────────────────────────────────┐
│ sidebarOverlay (fixed, top:64px, bottom:44px)       │  z-index: 300
│ width: 280px                                        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ bottomPanel (fixed, bottom:44px)                    │  z-index: 200
│ height: 200px (adjustable)                          │
└─────────────────────────────────────────────────────┘
```

---

## 布局原则

1. **Fixed 定位用于全局 UI 元素**
   - Header (TopBar)
   - Footer (BottomMenu)
   - SidebarOverlay
   - BottomPanel

2. **Flex 布局用于内容区域**
   - Body: `display: flex; flex-direction: column`
   - Content: `flex: 1; min-height: 0`
   - ContentBody: `flex: 1; overflow: auto`

3. **避免冲突的属性组合**
   - 不要同时使用 `flex: 1` 和固定的 `max-height`
   - 不要对子元素设置 `height: 100%` 当父元素使用 flex 布局
   - 避免使用 `!important`

4. **Overflow 控制**
   - 可滚动区域应该有明确的 `overflow: auto`
   - 父容器应该有 `min-height: 0` 允许 flex 子项收缩

---

## 测试验证

- ✅ 构建成功
- ✅ 类型检查通过（核心代码）
- ✅ CSS 变量一致性检查
- ✅ 布局层级验证
