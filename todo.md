# Todo List

## Project: Current Directory
Generated: 2026-04-17T03:48:49.105Z

---

## TODO
### [/root/pi-gateway-standalone/public/debug-system.js]
- [ ] 这个文件应该直接在index.html里面就加载，因为它是一个测试使用的js,不能把它封装成react 控件去调用，因为react 控件有问题的时候就看不到调试信息了，而且应该是最先同步加载的。
### [/root/pi-gateway-standalone/logs/test/latest]
- [ ] 你看一下服务器上这是不是应该是个目录，为什么file页面程序显示的时候会认为它是个文件？
### [/root/pi-gateway-standalone/AGENTS.md]
- [x] 对那个开发测试环境的。后前后端的重启，你看一下相关目录的脚本，再认真的编写一下。

以下是由开发用户的第一次的时候已经执行的启动，一般在在测试过程中不需要再进行这个完整的流程。你只需要看一下里面的相关脚本，如何单独重启后端或者单独重启前端就行了。
## Development Environment

**统一的开发测试环境（唯一推荐方式）**

```bash
# Start development services
bash scripts/dev.sh start
```

### 自动监控和热启动

开发环境下已配置自动监控和热启动：

| 组件 | 热启动方式 | 单独重启命令 |
|------|-----------|-------------|
| 后端 | `tsx watch` 自动重启 | `bash scripts/dev.sh restart-backend` |
| 前端 | Vite HMR 热更新 | `bash scripts/dev.sh restart-frontend` |

---

## Completed

---

## Metadata

### Statistics
- Total: 0
- Pending: 0
- Completed: 0
