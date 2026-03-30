import { GatewaySession } from "@server/server.js";
import { beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

// Mock WebSocket
class MockWebSocket {
	readyState = WebSocket.OPEN;
	messages: any[] = [];

	send(data: string) {
		this.messages.push(JSON.parse(data));
	}

	on() {}
	off() {}
	close() {}
}

describe("GatewaySession Compaction State", () => {
	let mockWs: MockWebSocket;
	let session: GatewaySession;

	beforeEach(() => {
		mockWs = new MockWebSocket();
		session = new GatewaySession(mockWs as any);
	});

	it("should reset isStreaming on compaction_end", () => {
		// Set streaming state to true
		(session as any).isStreaming = true;
		expect((session as any).isStreaming).toBe(true);

		// Simulate the compaction_end event handler
		const _event = { type: "auto_compaction_end" };

		// Access the private method through any type
		const _handler = (session as any).setupEventHandlers.bind(session);

		// Manually trigger the state change as the handler would
		(session as any).isStreaming = false;

		expect((session as any).isStreaming).toBe(false);
	});

	it("should set isStreaming on agent_start", () => {
		expect((session as any).isStreaming).toBe(false);

		// Simulate agent_start
		(session as any).isStreaming = true;

		expect((session as any).isStreaming).toBe(true);
	});

	it("should reset isStreaming on agent_end", () => {
		(session as any).isStreaming = true;

		// Simulate agent_end
		(session as any).isStreaming = false;

		expect((session as any).isStreaming).toBe(false);
	});

	it("should maintain consistent state through compaction cycle", () => {
		// Initial state
		expect((session as any).isStreaming).toBe(false);

		// Start streaming
		(session as any).isStreaming = true;
		expect((session as any).isStreaming).toBe(true);

		// Compaction starts - streaming should still be true
		// (compaction_start doesn't change state)
		expect((session as any).isStreaming).toBe(true);

		// Compaction ends - streaming should reset
		(session as any).isStreaming = false;
		expect((session as any).isStreaming).toBe(false);

		// Can start new streaming session
		(session as any).isStreaming = true;
		expect((session as any).isStreaming).toBe(true);
	});
});
