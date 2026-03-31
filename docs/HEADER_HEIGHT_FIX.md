# Header 高度修复记录

## 问题描述

Header (TopBar) 内部元素高度总和超出了容器高度，导致布局问题。

### 高度计算分析

**原始设置**:
- `.topBar`: `height: 64px` (包含 `border-bottom: 1px`)
- `.topRow`: `height: 36px` (包含 `padding: 6px 12px` = 12px)
- `.bottomRow`: `height: 28px` (包含 `padding: 4px 12px` = 8px, `border-top: 1px`)

**问题计算** (border-box 模式):
- `.topBar` 内部可用空间: 64px - 1px (border) = 63px
- 子元素总高度: 36px + 28px = 64px
- **溢出: 1px** ❌

## 修复方案

将 `.topBar` 高度从 `64px` 改为 `65px`：
- 内部可用空间: 65px - 1px = 64px
- 子元素总高度: 36px + 28px = 64px
- **完美匹配** ✅

## 修改的文件

1. **TopBar.module.css**
   ```css
   .topBar {
     height: 65px; /* 原为 64px */
   }
   ```

2. **AppLayout.module.css**
   ```css
   .header {
     height: 65px; /* 原为 64px */
   }
   
   .sidebarOverlay {
     top: 65px; /* 原为 64px */
   }
   
   @media (max-width: 767px) {
     .header { height: 57px; } /* 原为 56px */
     .sidebarOverlay { top: 57px; } /* 原为 56px */
   }
   ```

3. **App.module.css** (备用样式)
   ```css
   .appContainer {
     grid-template-rows: 65px 1fr auto 44px; /* 第一列原为 64px */
   }
   ```

4. **AppLayout.tsx**
   ```tsx
   {/* 1. 顶部菜单 - 固定高度65px */} {/* 原为 64px */}
   ```

5. **UI_LAYOUT_SPEC.md** (文档)
   - 更新 Header 尺寸说明: 65px (Desktop) / 57px (Mobile)

## 验证

- ✅ 构建成功
- ✅ 类型检查通过
- ✅ 高度计算: 36px + 28px = 64px ≤ 65px 可用空间
