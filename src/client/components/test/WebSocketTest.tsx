/**
 * WebSocket测试组件
 * 用于验证WebSocket连接和消息发送功能
 */

import { useEffect, useState } from "react";
import { websocketService } from "@/services/websocket.service";

export function WebSocketTest() {
	const [status, setStatus] = useState<string>("未连接");
	const [messages, setMessages] = useState<string[]>([]);
	const [inputText, setInputText] = useState<string>("");
	const [isConnected, setIsConnected] = useState<boolean>(false);

	useEffect(() => {
		// 监听连接状态
		const handleConnected = () => {
			setStatus("已连接");
			setIsConnected(true);
			addMessage("WebSocket连接成功");
		};

		const handleDisconnected = () => {
			setStatus("已断开");
			setIsConnected(false);
			addMessage("WebSocket连接断开");
		};

		const handleError = (error: any) => {
			setStatus(`错误: ${error?.message || "未知错误"}`);
			addMessage(`WebSocket错误: ${JSON.stringify(error)}`);
		};

		// 监听WebSocket事件
		websocketService.on("connected", handleConnected);
		websocketService.on("disconnected", handleDisconnected);
		websocketService.on("error", handleError);

		// 监听消息事件
		websocketService.on("content_delta", (data) => {
			addMessage(`收到内容增量: ${data.text}`);
		});

		websocketService.on("initialized", (data) => {
			addMessage(`初始化完成: ${JSON.stringify(data)}`);
		});

		websocketService.on("session_created", (data) => {
			addMessage(`会话创建: ${JSON.stringify(data)}`);
		});

		// 检查当前连接状态
		if (websocketService.isConnected) {
			setStatus("已连接");
			setIsConnected(true);
		}

		return () => {
			// 清理监听器
			websocketService.off("connected", handleConnected);
			websocketService.off("disconnected", handleDisconnected);
			websocketService.off("error", handleError);
		};
	}, []);

	const addMessage = (msg: string) => {
		setMessages((prev) => [
			...prev,
			`${new Date().toLocaleTimeString()}: ${msg}`,
		]);
	};

	const connectWebSocket = async () => {
		try {
			setStatus("连接中...");
			addMessage("正在连接WebSocket...");
			await websocketService.connect();
		} catch (error) {
			setStatus(`连接失败: ${error}`);
			addMessage(`连接失败: ${error}`);
		}
	};

	const disconnectWebSocket = () => {
		websocketService.disconnect();
		setStatus("已断开");
		setIsConnected(false);
		addMessage("已断开WebSocket连接");
	};

	const sendTestMessage = () => {
		if (!inputText.trim()) return;

		addMessage(`发送消息: ${inputText}`);
		const success = websocketService.sendMessage(inputText);

		if (success) {
			addMessage("消息发送成功");
			setInputText("");
		} else {
			addMessage("消息发送失败");
		}
	};

	const initWorkingDirectory = async () => {
		try {
			addMessage("正在初始化工作目录...");
			const result = await websocketService.initWorkingDirectory("/root");
			addMessage(`初始化结果: ${JSON.stringify(result)}`);
		} catch (error) {
			addMessage(`初始化失败: ${error}`);
		}
	};

	return (
		<div style={{ padding: "20px", fontFamily: "monospace" }}>
			<h2>WebSocket测试</h2>

			<div style={{ marginBottom: "20px" }}>
				<div>
					状态: <strong>{status}</strong>
				</div>
				<div>连接状态: {isConnected ? "✅ 已连接" : "❌ 未连接"}</div>
				<div>WebSocket URL: ws://127.0.0.1:3000</div>
			</div>

			<div style={{ marginBottom: "20px" }}>
				<button
					onClick={connectWebSocket}
					disabled={isConnected}
					style={{ marginRight: "10px", padding: "5px 10px" }}
				>
					连接WebSocket
				</button>

				<button
					onClick={disconnectWebSocket}
					disabled={!isConnected}
					style={{ marginRight: "10px", padding: "5px 10px" }}
				>
					断开连接
				</button>

				<button
					onClick={initWorkingDirectory}
					disabled={!isConnected}
					style={{ marginRight: "10px", padding: "5px 10px" }}
				>
					初始化工作目录
				</button>
			</div>

			<div style={{ marginBottom: "20px" }}>
				<input
					type="text"
					value={inputText}
					onChange={(e) => setInputText(e.target.value)}
					placeholder="输入测试消息"
					style={{ width: "300px", padding: "5px", marginRight: "10px" }}
					onKeyPress={(e) => e.key === "Enter" && sendTestMessage()}
				/>

				<button
					onClick={sendTestMessage}
					disabled={!isConnected || !inputText.trim()}
					style={{ padding: "5px 10px" }}
				>
					发送消息
				</button>
			</div>

			<div style={{ marginBottom: "20px" }}>
				<h3>测试其他功能:</h3>
				<button
					onClick={() => websocketService.listModels()}
					disabled={!isConnected}
					style={{ marginRight: "10px", padding: "5px 10px" }}
				>
					列出模型
				</button>

				<button
					onClick={() => websocketService.listSessions("/root")}
					disabled={!isConnected}
					style={{ marginRight: "10px", padding: "5px 10px" }}
				>
					列出会话
				</button>

				<button
					onClick={() => websocketService.send("new_session")}
					disabled={!isConnected}
					style={{ marginRight: "10px", padding: "5px 10px" }}
				>
					创建新会话
				</button>
			</div>

			<div>
				<h3>消息日志:</h3>
				<div
					style={{
						height: "300px",
						overflowY: "auto",
						border: "1px solid #ccc",
						padding: "10px",
						backgroundColor: "#f5f5f5",
						fontSize: "12px",
					}}
				>
					{messages.length === 0 ? (
						<div>暂无消息</div>
					) : (
						messages.map((msg, index) => (
							<div key={index} style={{ marginBottom: "5px" }}>
								{msg}
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}
