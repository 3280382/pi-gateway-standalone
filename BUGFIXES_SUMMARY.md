# Bug 修复总结

## 1. 新会话按钮 - 后端事件类型不匹配 ✅ 已修复

**问题**: 点击新会话按钮只初始化了前端界面，后端 pi 进程没有新建初始化

**原因**: 后端发送 `session_info` 事件，但前端期望 `session_created` 事件

**修复**: 
- 文件: `src/server/features/session/ws/new-session.ts`
- 修改: 将 `type: "session_info"` 改为 `type: "session_created"`

```typescript
// 修复前
type: "session_info"

// 修复后
type: "session_created"
```

---

## 2. AI 回复代码块样式统一 ✅ 已修复

**问题**: 代码块的边框线、背景颜色、分隔线颜色不一致

**修复**:
- 文件: `src/client/features/chat/components/MessageItem.module.css`
- 统一使用 GitHub 风格的颜色方案

```css
/* 统一颜色 */
.codeContainer {
    background: #161b22;
    border: 1px solid #30363d;
}

.codeHeader {
    background: #21262d;
    border-bottom: 1px solid #30363d;
}

.codePre {
    background: #161b22;
}
```

---

## 3. 文件浏览器 - 文件夹大小列显示问题

**问题**: 文件夹没有显示大小列

**说明**: 这是设计预期行为，因为文件夹本身没有固定大小
- 文件: `src/client/features/files/components/FileItem.tsx`
- 代码: `{item.isDirectory ? "" : formatFileSize(item.size)}`

**如果需要显示文件夹大小**, 需要后端 API 计算目录总大小

---

## 4. 文件删除功能失败 - 需要验证

**检查点**:
- 前端代码: `src/client/features/files/stores/fileStore.ts` - `deleteSelectedItems`
- 后端代码: `src/server/controllers/file.controller.ts` - `batchDeleteFiles`
- API 端点: `POST /api/files/batch-delete`

**删除限制**:
- 最多删除 100 个文件
- 禁止删除系统关键目录 (`/`, `/bin`, `/etc` 等)
- 路径必须通过 `isPathAllowed` 检查

**如果删除失败**:
1. 检查浏览器控制台网络请求
2. 查看服务器日志
3. 确认文件权限

---

## 5. 复选框单击选中问题 ✅ 已修复

**问题**: 复选状态下需要长按才能选择，应该单击即可选中

**原因**: 复选框点击事件被父元素的手势处理器截获

**修复**:
- 文件: `src/client/features/files/components/FileItem.tsx`
- 添加事件阻止冒泡处理

```typescript
// 新增事件处理器
const handleCheckboxTouchStart = useCallback((e) => {
    e.stopPropagation();
}, []);

const handleCheckboxMouseDown = useCallback((e) => {
    e.stopPropagation();
}, []);

// 更新复选框 JSX
<div
    onMouseDown={handleCheckboxMouseDown}
    onTouchStart={(e) => {
        handleCheckboxTouchStart(e);
        handleCheckboxClick(e);
    }}
>
```

---

## 测试状态

```bash
# 运行服务端测试
npx vitest run src/server
# ✅ 6 个测试文件，35 个测试全部通过

# 运行客户端测试
npx vitest run src/client/features/chat/stores
# ✅ 1 个测试文件，13 个测试全部通过
```

---

## 验证步骤

1. **新会话按钮**:
   - 打开聊天界面
   - 点击输入框右侧的 "+" 按钮
   - 检查是否收到 `session_created` 事件 (浏览器 DevTools Network WS)

2. **代码块样式**:
   - 让 AI 回复包含代码块
   - 检查代码块边框、背景、分隔线颜色是否统一为 #161b22/#21262d/#30363d

3. **复选框单击**:
   - 进入文件浏览器
   - 长按文件进入多选模式
   - 单击复选框即可选中/取消选中 (不需要长按)

4. **文件删除**:
   - 选择多个文件
   - 点击 Delete 按钮
   - 确认删除
   - 检查是否成功删除 (需要实际文件权限)
