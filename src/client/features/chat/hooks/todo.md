# Todo List

## Project: Current Directory
Generated: 2026-04-13T11:47:32.659Z

---

## TODO
### [/root/pi-gateway-standalone/src/client/features/chat/hooks/useChatInit.ts]
- [ ] 该文件刷新第一次初始化的时候，只使用当前工作目录进行piAgentSession恢复useWorkspaceStore.getState().workingDir;如果不存在piAgentSession,只要使用传入的工作目录新建;果有存在的piAgentSession,两者的工作目录一致,直接使用这个piAgentSession,并且重新订阅他的事件.如果两者不一致，则切换目录到workingDir.然后在这里不用初始化侧面板的最近工作目录和相应的session文件.应该延迟到侧面板打开的时候才进行。

---

## Completed

---

## Metadata

### Statistics
- Total: 0
- Pending: 0
- Completed: 0
