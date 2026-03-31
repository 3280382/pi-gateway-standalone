# Flex + 文档流 布局规范

> **方案**: 纯 Flex 布局，不使用 fixed/absolute  
> **日期**: 2026-03-30  
> **状态**: 已实施

---

## 布局架构

```
┌─────────────────────────────────────────────────────────┐
│ layout (flex column, 100vh)                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ header (flex-shrink: 0, height: 65px)               │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ main (flex: 1, min-height: 0, flex row)             │ │
│ │ ┌──────────┬─────────────────────────────────────┐  │ │
│ │ │ sidebar  │ content (flex column)               │  │ │
│ │ │ (fixed   │ ┌─────────────────────────────────┐ │  │ │
│ │ │  width)  │ │ contentBody (flex: 1,          │ │  │ │
│ │ │          │ │              overflow: auto)    │ │  │ │
│ │ │          │ │                                 │ │  │ │
│ │ │          │ │ [MessageList / FileBrowser]     │ │  │ │
│ │ │          │ │                                 │ │  │ │
│ │ │          │ └─────────────────────────────────┘ │  │ │
│ │ │          │ ┌─────────────────────────────────┐ │  │ │
│ │ │          │ │ bottomPanel (flex-shrink: 0)    │ │  │ │
│ │ │          │ │ (可选，可调整高度)                │ │  │ │
│ │ │          │ └─────────────────────────────────┘ │  │ │
│ │ │          │ ┌─────────────────────────────────┐ │  │ │
│ │ │          │ │ inputArea (flex-shrink: 0)      │ │  │ │
│ │ │          │ │ (可选)                          │ │  │ │
│ │ │          │ └─────────────────────────────────┘ │  │ │
│ │ └──────────┴─────────────────────────────────────┘  │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ footer (flex-shrink: 0, height: 44px)               │ │
│ │ [BottomMenu]                                        │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 关键原则

### 1. 不使用 Fixed/Absolute 定位

| 元素 | 旧方案 | 新方案 |
|------|--------|--------|
| Header | `position: relative` | `flex-shrink: 0` |
| Sidebar | `position: fixed` | Flex 子项 |
| BottomPanel | `position: fixed` | Flex 子项 |
| Footer | `position: fixed` | `flex-shrink: 0` |

### 2. Flex 收缩控制

```css
/* 固定高度元素 */
.header, .footer {
  flex-shrink: 0;
}

/* 自适应填充 */
.main {
  flex: 1;
  min-height: 0; /* 关键：允许收缩 */
}

/* 可滚动区域 */
.contentBody {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
```

### 3. 无 Padding Hack

❌ 不再使用：
```css
.main {
  padding-bottom: 44px; /* 为 fixed footer 腾空间 */
}
```

✅ 新方案：
```css
.footer {
  flex-shrink: 0; /* 正常文档流 */
}
```

---

## 代码实现

### AppLayout.module.css

```css
.layout {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.header {
  flex-shrink: 0;
  height: 65px;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: row;
  min-height: 0;
  overflow: hidden;
}

.sidebar {
  flex-shrink: 0;
  width: 280px;
  /* ... */
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.contentBody {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.bottomPanel {
  flex-shrink: 0;
  /* 高度通过 style 动态设置 */
}

.inputArea {
  flex-shrink: 0;
}

.footer {
  flex-shrink: 0;
  height: 44px;
}
```

### AppLayout.tsx 结构

```tsx
<div className={styles.layout}>
  <header className={styles.header}>
    <TopBar />
  </header>

  <div className={styles.main}>
    <aside className={styles.sidebar}>
      <SidebarPanel />
    </aside>

    <div className={styles.content}>
      <div className={styles.contentBody}>
        {children}
      </div>

      {isBottomPanelOpen && (
        <div className={styles.bottomPanel}>
          {bottomPanelContent}
        </div>
      )}

      {showInput && (
        <div className={styles.inputArea}>
          <InputArea />
        </div>
      )}
    </div>
  </div>

  <footer className={styles.footer}>
    <BottomMenu />
  </footer>
</div>
```

---

## 响应式适配

### 移动端侧边栏

```css
@media (max-width: 767px) {
  .sidebar {
    position: absolute; /* 仅在移动端使用 absolute */
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 300;
  }

  .sidebarHidden {
    transform: translateX(-100%);
    display: flex; /* 保持 flex 以便动画 */
  }
}
```

> 注：移动端侧边栏仍使用 `absolute`，因为这是 drawer 模式的唯一可行方案。

---

## 优势对比

| 特性 | Fixed + Padding Hack | Flex + 文档流 |
|------|---------------------|---------------|
| 代码复杂度 | 高（需要计算 padding） | 低（自然流） |
| 可维护性 | 差（高度变化需同步） | 好（自动适应） |
| 性能 | 差（分层合成） | 好（正常渲染） |
| 可访问性 | 差（焦点管理复杂） | 好（自然 Tab 顺序） |
| 移动端适配 | 复杂 | 简单 |

---

## 已修改文件

1. **AppLayout.module.css** - 重写为 Flex 布局
2. **AppLayout.tsx** - 调整结构，sidebar 移入 main
3. **BottomMenu.module.css** - 移除 `position: fixed`
4. **global.css** - 移除 padding hack

---

## 构建验证

```
✓ 89 modules transformed
✓ built in 1.21s
```
