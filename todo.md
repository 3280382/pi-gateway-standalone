# Todo List

## Project: Current Directory
Generated: 2026-04-15T13:34:43.771Z

---

## TODO
### [/root/pi-gateway-standalone/src/server/features/chat/ws-handlers]
- [ ] 需要关注服务端这个目录代码的修改。
### [/root/pi-gateway-standalone/src/client/features/chat/components/InputArea.tsx]
- [ ] 在这个文件的聊天输入框右侧，应该是现在的send按钮,然后下面插入一个Abort按钮,下面才是原来的新建按钮。isStreaming表示的还是消息是否正在流式显示。增加一个isRunning，这个是监听Pi coating agent的turn start好turn end事件,在turn star和end之间就是isRunning,只有isRunning是true的时候,abort按钮才是激活状态,这个时候send按钮触发的是steer.send爱你在不是isRunning的时候，触发的是prompt. 这个需要你同时修改服务器后端的相关逻辑,包括增加事件发送,增加或者确认事件接收处理逻辑。 需要去阅读pi codingagent的相关事件及sdk函数.

---

## Completed

---

## Metadata

### Statistics
- Total: 0
- Pending: 0
- Completed: 0
