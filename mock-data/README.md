# Mock 数据

开发环境使用的模拟数据。

## 用途

Vite 开发服务器使用这些文件作为 Mock API 响应。

## 文件说明

| 文件 | 用途 |
|------|------|
| `api-responses/models.json` | 可用模型列表 |
| `api-responses/system-prompt.json` | 系统提示词 |
| `sessions/index.json` | 会话列表 |
| `sessions/*.jsonl` | 会话消息数据 |
| `files/*.json` | 文件浏览数据 |

## 使用

开发模式下（`npm run dev:react`），Vite 会自动使用这些文件作为 API 响应。

生产环境使用真实的后端 API。
