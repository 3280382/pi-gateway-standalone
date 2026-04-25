/**
 * Agent Tool — In-process sub-agent management for pi
 *
 * This tool runs inside pi's process and directly accesses the server's
 * session management infrastructure. No HTTP, no IPC — direct function calls.
 *
 * Architecture:
 * - All pi sessions share the same Node.js process
 * - serverSessionManager tracks all active sessions (Map<shortId, SessionEntry>)
 * - sessionConfigManager persists parent/child relationships in sessions.json
 * - The tool factory injects LlmLogManager for sub-agent session creation
 */

import { Type } from "@sinclair/typebox";
import { defineTool, SessionManager } from "@mariozechner/pi-coding-agent";
import type { LlmLogManager } from "../chat/llm/log-manager.js";
import { serverSessionManager, extractShortSessionId } from "../chat/session/SessionRegistry.js";
import { sessionConfigManager } from "../chat/session/SessionConfig.js";
import { agentConfigManager } from "./AgentConfigManager.js";
import { PiAgentSession } from "../chat/session/PiAgentSession.js";
import { getLocalSessionsDir } from "../chat/session/utils.js";

/**
 * Create the agent_tool with injected LlmLogManager.
 * Called once per PiAgentSession initialization.
 */
export function createAgentTool(llmLogManager: LlmLogManager, mySessionId: string) {
  return defineTool({
    name: "agent_tool",
    label: "Agent Tool",
    description: `Manage sub-agents (child pi sessions running in the same process).

This session's ID is: ${mySessionId}
Use this ID to reference yourself when creating sub-agents (optional — the tool auto-detects the calling session).

ACTIONS:

1) "create_sub_agent" — Spawn a new pi session with read/bash/edit/write tools.
   Required: workingDir, name
   Optional: agentId (agent config), initialPrompt (first task)
   The tool automatically registers this session as the parent.

2) "send_to_sub_agent" — Send a prompt to a running child session.
   Required: sessionId (child's shortId), prompt (message text)
   Use this to check status, give instructions, or review output.

3) "list_children" — List all child sessions of this session.
   No parameters needed — auto-detects parent from calling session.

Sub-agents are full pi sessions. They run independently in the same process.
They do NOT have agent_tool themselves.
Use send_to_sub_agent to communicate with them after creation.`,

    parameters: Type.Object({
      action: Type.String({ description: "create_sub_agent | send_to_sub_agent | list_children" }),
      workingDir: Type.Optional(
        Type.String({ description: "Working directory for sub-agent (default: current)" })
      ),
      name: Type.Optional(Type.String({ description: "Sub-agent display name" })),
      agentId: Type.Optional(Type.String({ description: "Agent config ID from the Agents page" })),
      initialPrompt: Type.Optional(
        Type.String({ description: "First prompt/task for the sub-agent" })
      ),
      sessionId: Type.Optional(
        Type.String({ description: "Target child session shortId (for send_to_sub_agent)" })
      ),
      prompt: Type.Optional(
        Type.String({ description: "Prompt text to send (for send_to_sub_agent)" })
      ),
    }),

    execute: async (_toolCallId, params) => {
      const { action } = params as any;

      try {
        switch (action) {
          // ======== CREATE SUB-AGENT ========
          case "create_sub_agent": {
            const p = params as any;
            const workingDir = p.workingDir || process.cwd();
            const parentId = mySessionId; // Auto-detected from closure — no need for LLM to pass

            // Resolve agent config
            let agentConfig = undefined;
            if (p.agentId) {
              await agentConfigManager.init();
              agentConfig = agentConfigManager.getAgent(p.agentId);
            }

            // Create new session file
            const localDir = getLocalSessionsDir(workingDir);
            const sm = SessionManager.create(workingDir, localDir);
            const sessionFile = sm.getSessionFile();
            if (!sessionFile) return fail("Failed to create session file");

            const childId = extractShortSessionId(sessionFile);

            // Register parent-child relationship (in-memory + persist)
            await serverSessionManager.registerChild(parentId, childId);

            // Set name and agent
            if (p.name) await sessionConfigManager.updateName(childId, p.name);
            if (agentConfig) {
              await sessionConfigManager.setAgent(
                childId,
                agentConfig.id,
                agentConfig.name,
                sessionFile,
                workingDir
              );
            }

            // Create PiAgentSession (no WebSocket — sub-agent runs headless)
            // Use the parent's WS client for event routing if available
            const parentEntry = serverSessionManager.getSessionByShortId(parentId);
            const ws = parentEntry?.client;
            const childSession = new PiAgentSession(ws || (null as any), llmLogManager);
            await childSession.initialize(workingDir, sessionFile, agentConfig);

            // Register parent-child (in-memory + persisted via serverSessionManager)
            await serverSessionManager.registerNewSession(
              workingDir,
              ws || (null as any),
              childSession,
              sessionFile,
              parentId
            );

            // Send initial prompt (fire-and-forget — don't block tool return)
            if (p.initialPrompt) {
              childSession
                .prompt(p.initialPrompt)
                .catch((e) => console.error("[AgentTool] Sub-agent prompt error:", e));
            }

            return ok({
              sessionId: childId,
              sessionFile,
              parentId,
              name: p.name || "Sub-Agent",
              message: p.initialPrompt
                ? `Sub-agent created. Initial prompt sent asynchronously. Use send_to_sub_agent with sessionId=${childId} to check progress or send follow-ups.`
                : `Sub-agent created (idle). Use send_to_sub_agent with sessionId=${childId} to send prompts.`,
            });
          }

          // ======== SEND TO SUB-AGENT ========
          case "send_to_sub_agent": {
            const p = params as any;
            if (!p.sessionId || !p.prompt) {
              return fail("sessionId and prompt are required");
            }

            const entry = serverSessionManager.getSessionByShortId(p.sessionId);
            if (!entry?.session?.session) {
              return fail(
                `Sub-agent session ${p.sessionId} not found or not active. Use list_children to find active sessions.`
              );
            }

            await entry.session.prompt(p.prompt);

            return ok({
              sent: true,
              sessionId: p.sessionId,
              message: `Prompt sent to sub-agent ${p.sessionId}. The sub-agent will process it independently.`,
            });
          }

          // ======== LIST CHILDREN ========
          case "list_children": {
            const p = params as any;
            const parentId = p.parentId || mySessionId; // Auto-detect if not specified
            const children = serverSessionManager.getChildren(parentId);
            return ok({
              parentId: p.parentId,
              children: children.map((c) => ({
                sessionId: c.shortId,
                workingDir: c.workingDir,
                status: c.runtimeStatus,
              })),
            });
          }

          default:
            return fail(
              `Unknown action: ${action}. Use create_sub_agent, send_to_sub_agent, or list_children.`
            );
        }
      } catch (error) {
        return fail(`Agent tool error: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  });
}

function ok(details: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(details, null, 2) }],
    details,
  };
}

function fail(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    details: { error: message },
  };
}
