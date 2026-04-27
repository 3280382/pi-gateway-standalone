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

create_sub_agent — Spawn new pi sessions.
  Params: agents: [{name, initialPrompt}] — array of sub-agents to create
  Returns: [{sessionId, name, created}]
  Sub-agents run in the parent's workingDir. They auto-report results back to parent on completion.
  NOTE: initialPrompt is automatically prefixed with sub-agent identity metadata.

send_to_sub_agent — Send a prompt to a running child session.
  Params: sessionId (child's shortId), prompt, mode? ("followUp"|"steer", default "followUp")
  Use to give new instructions or request mid-task updates.

list_children — List all child sessions with status.
  Returns: children with { sessionId, workingDir, status }
  status: "idle"|"tooling"|"waiting"
  NOTE: sub-agents auto-report results. Only use list_children when user explicitly asks for status.

=== PATTERNS ===

PARALLEL: Create N sub-agents without waiting. Each reports via send_to_parent when done. Parent simply waits for results.
SERIAL: Create sub-agent, wait for send_to_parent report, create next dependent sub-agent.

=== RULES ===
- Sub-agents: NO need to call send_to_parent. Results are auto-forwarded to parent on completion.
- Parent: default behavior is to wait for sub-agents to complete. Only use list_children when user asks.
- CRITICAL: After calling create_sub_agent, end your current turn immediately. The sub-agents run independently.
- All sessions share the same Node.js process — no HTTP, no IPC`,

    parameters: Type.Object({
      action: Type.String({
        description: "create_sub_agent | send_to_sub_agent | list_children | send_to_parent",
      }),
      workingDir: Type.Optional(Type.String({ description: "Working directory" })),
      name: Type.Optional(Type.String({ description: "Display name for sub-agent" })),
      agentId: Type.Optional(Type.String({ description: "Pre-configured agent config ID" })),
      initialPrompt: Type.Optional(Type.String({ description: "First task for sub-agent" })),
      sessionId: Type.Optional(Type.String({ description: "Target child session ID" })),
      prompt: Type.Optional(Type.String({ description: "Message to send" })),
      message: Type.Optional(
        Type.String({ description: "Summary for parent (include output file paths)" })
      ),
    }),

    execute: async (_toolCallId, params) => {
      const { action } = params as any;
      try {
        switch (action) {
          case "create_sub_agent": {
            const p = params as any;
            const parentId = mySessionId;
            const parentEntry = serverSessionManager.getSessionByShortId(parentId);
            // Sub-agents always run in the parent's workingDir.
            // Cross-directory agents risk process.chdir() races
            // since cwd is process-level, not per-session.
            const workingDir = parentEntry?.workingDir || process.cwd();

            console.log(`[AgentTool] create_sub_agent name="${p.name}" workdir=${workingDir}`);

            let agentConfig = undefined;
            if (p.agentId) {
              await agentConfigManager.init();
              agentConfig = agentConfigManager.getAgent(p.agentId);
            }

            const localDir = getLocalSessionsDir(workingDir);
            const sm = SessionManager.create(workingDir, localDir);
            const sessionFile = sm.getSessionFile();
            if (!sessionFile) return fail("Failed to create session file");
            const childId = extractShortSessionId(sessionFile);
            console.log(`[AgentTool] childId=${childId}`);

            await serverSessionManager.registerChild(parentId, childId);
            if (p.name) await sessionConfigManager.updateName(childId, p.name, workingDir);
            if (agentConfig)
              await sessionConfigManager.setAgent(
                childId,
                agentConfig.id,
                agentConfig.name,
                sessionFile,
                workingDir
              );

            const ws = parentEntry?.client;
            const childSession = new PiAgentSession(ws || (null as any), llmLogManager);
            await childSession.initialize(workingDir, sessionFile, agentConfig);
            childSession.parentId = parentId;
            await serverSessionManager.registerNewSession(
              workingDir,
              ws || (null as any),
              childSession,
              sessionFile,
              parentId
            );

            if (p.initialPrompt) {
              const prefixedPrompt =
                `[SUB-AGENT] \`${childId}\` from \`${parentId}\`\n` +
                `You were created by parent agent \`${parentId}\` via agent_tool(action="create_sub_agent").\n` +
                `Your session ID: \`${childId}\`\n\n` +
                `Your task:\n${p.initialPrompt}\n\n` +
                `⚠️ IMPORTANT: When you finish your task, you MUST report back to the parent using agent_tool(action="send_to_parent", message="..."). Include a summary + file manifest. Do NOT just reply in chat — use agent_tool.`;
              childSession
                .prompt(prefixedPrompt)
                .catch((e) => console.error("[AgentTool] prompt error:", e));
            }
            return ok({
              sessionId: childId,
              created: true,
              status: "running",
              note: "Sub-agent is now running independently in the background. It will report back via send_to_parent when done. End your current turn NOW — do NOT wait or poll.",
            });
          }

          case "send_to_sub_agent": {
            const p = params as any;
            if (!p.sessionId || !p.prompt) return fail("sessionId and prompt required");
            const entry = serverSessionManager.getSessionByShortId(p.sessionId);
            if (!entry?.session?.session) return fail(`Session ${p.sessionId} not found`);
            const mode = p.mode === "steer" ? "steer" : "followUp";
            if (mode === "steer") {
              await entry.session.steer(p.prompt);
            } else {
              await entry.session.followUp(p.prompt);
            }
            return ok({ sent: true, sessionId: p.sessionId, mode });
          }

          case "list_children": {
            const children = serverSessionManager.getChildren(mySessionId);
            return ok({
              parentId: mySessionId,
              children: children.map((c) => ({
                sessionId: c.shortId,
                workingDir: c.workingDir,
                status: c.runtimeStatus,
              })),
            });
          }

          default:
            return fail(
              `Unknown action: ${action}. Use create_sub_agent, send_to_sub_agent, list_children, or send_to_parent.`
            );
        }
      } catch (error) {
        return fail(`Agent tool error: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  });
}

function ok(d: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: JSON.stringify(d, null, 2) }], details: d };
}
function fail(m: string) {
  return { content: [{ type: "text" as const, text: m }], details: { error: m } };
}
