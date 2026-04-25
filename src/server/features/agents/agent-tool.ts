/**
 * Agent Tool — In-process sub-agent management + parent communication
 */
import { Type } from "@sinclair/typebox";
import { defineTool, SessionManager } from "@mariozechner/pi-coding-agent";
import type { LlmLogManager } from "../chat/llm/log-manager.js";
import { serverSessionManager, extractShortSessionId } from "../chat/session/SessionRegistry.js";
import { sessionConfigManager } from "../chat/session/SessionConfig.js";
import { agentConfigManager } from "./AgentConfigManager.js";
import { PiAgentSession } from "../chat/session/PiAgentSession.js";
import { getLocalSessionsDir } from "../chat/session/utils.js";

export function createAgentTool(llmLogManager: LlmLogManager, mySessionId: string) {
  return defineTool({
    name: "agent_tool",
    label: "Agent Tool",
    description: `Manage sub-agents and communicate with parent. All in-process, zero latency.

YOUR SESSION ID: ${mySessionId}

=== ACTIONS ===

create_sub_agent — Spawn a new pi session with read/bash/edit/write tools.
  Params: workingDir, name, initialPrompt (optional: agentId)
  Returns: { sessionId, sessionFile, parentId, name }
  Sub-agent runs asynchronously. Create multiple in parallel for independent tasks.

send_to_sub_agent — Send a prompt to a running child session.
  Params: sessionId (child's shortId), prompt
  Use to check status, give new instructions, or receive results.

list_children — List all child sessions with status.
  Returns: children with { sessionId, workingDir, status }
  status: "idle"|"tooling"|"waiting"

send_to_parent — [SUB-AGENT ONLY] Report results back to parent.
  Params: message (summary + output file manifest)
  Parent receives via followUp (non-blocking queue).
  Example: agent_tool(action="send_to_parent", message="✓ DONE. Files: DESIGN.md (2KB), index.html (4KB)")

=== PATTERNS ===

PARALLEL: Create N sub-agents without waiting. Each reports via send_to_parent when done.
SERIAL: Create sub-agent, wait for send_to_parent report, create next dependent sub-agent.

=== RULES ===
- Sub-agents: ALWAYS call send_to_parent with file manifest when task is complete
- Parent: use list_children for status, send_to_sub_agent to ping
- All sessions share the same Node.js process — no HTTP, no IPC`,

    parameters: Type.Object({
      action: Type.String({ description: "create_sub_agent | send_to_sub_agent | list_children | send_to_parent" }),
      workingDir: Type.Optional(Type.String({ description: "Working directory" })),
      name: Type.Optional(Type.String({ description: "Display name for sub-agent" })),
      agentId: Type.Optional(Type.String({ description: "Pre-configured agent config ID" })),
      initialPrompt: Type.Optional(Type.String({ description: "First task for sub-agent" })),
      sessionId: Type.Optional(Type.String({ description: "Target child session ID" })),
      prompt: Type.Optional(Type.String({ description: "Message to send" })),
      message: Type.Optional(Type.String({ description: "Summary for parent (include output file paths)" })),
    }),

    execute: async (_toolCallId, params) => {
      const { action } = params as any;
      try {
        switch (action) {
          case "create_sub_agent": {
            const p = params as any;
            const workingDir = p.workingDir || process.cwd();
            const parentId = mySessionId;

            let agentConfig = undefined;
            if (p.agentId) { await agentConfigManager.init(); agentConfig = agentConfigManager.getAgent(p.agentId); }

            const localDir = getLocalSessionsDir(workingDir);
            const sm = SessionManager.create(workingDir, localDir);
            const sessionFile = sm.getSessionFile();
            if (!sessionFile) return fail("Failed to create session file");
            const childId = extractShortSessionId(sessionFile);

            await serverSessionManager.registerChild(parentId, childId);
            if (p.name) await sessionConfigManager.updateName(childId, p.name, workingDir);
            if (agentConfig) await sessionConfigManager.setAgent(childId, agentConfig.id, agentConfig.name, sessionFile, workingDir);

            const parentEntry = serverSessionManager.getSessionByShortId(parentId);
            const ws = parentEntry?.client;
            const childSession = new PiAgentSession(ws || (null as any), llmLogManager);
            await childSession.initialize(workingDir, sessionFile, agentConfig);
            await serverSessionManager.registerNewSession(workingDir, ws || (null as any), childSession, sessionFile, parentId);

            if (p.initialPrompt) {
              childSession.prompt(p.initialPrompt).catch((e) => console.error("[AgentTool] prompt error:", e));
            }
            return ok({ sessionId: childId, sessionFile, parentId, name: p.name || "Sub-Agent", created: true });
          }

          case "send_to_sub_agent": {
            const p = params as any;
            if (!p.sessionId || !p.prompt) return fail("sessionId and prompt required");
            const entry = serverSessionManager.getSessionByShortId(p.sessionId);
            if (!entry?.session?.session) return fail(`Session ${p.sessionId} not found`);
            await entry.session.prompt(p.prompt);
            return ok({ sent: true, sessionId: p.sessionId });
          }

          case "list_children": {
            const children = serverSessionManager.getChildren(mySessionId);
            return ok({ parentId: mySessionId, children: children.map((c) => ({ sessionId: c.shortId, workingDir: c.workingDir, status: c.runtimeStatus })) });
          }

          case "send_to_parent": {
            const p = params as any;
            if (!p.message) return fail("message required — include summary and output file paths");
            const parentEntry = serverSessionManager.getParentEntry(mySessionId);
            if (!parentEntry?.session?.session) return fail(`Parent not active. Your session: ${mySessionId}`);
            await parentEntry.session.followUp(p.message);
            return ok({ sent: true, toParent: parentEntry.shortId });
          }

          default:
            return fail(`Unknown action: ${action}. Use create_sub_agent, send_to_sub_agent, list_children, or send_to_parent.`);
        }
      } catch (error) {
        return fail(`Agent tool error: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  });
}

function ok(d: Record<string, unknown>) { return { content: [{ type: "text" as const, text: JSON.stringify(d, null, 2) }], details: d }; }
function fail(m: string) { return { content: [{ type: "text" as const, text: m }], details: { error: m } }; }
