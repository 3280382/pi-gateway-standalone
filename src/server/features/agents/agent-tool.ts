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
  Params: name, initialPrompt (optional: agentId)
  Returns: { sessionId, sessionFile, parentId, name }
  Sub-agent runs in the parent's workingDir. Create multiple in parallel for independent tasks.
  NOTE: initialPrompt is automatically prefixed with sub-agent identity metadata (parent ID, session ID, workingDir) so the sub-agent knows its context.

send_to_sub_agent — Send a prompt to a running child session.
  Params: sessionId (child's shortId), prompt
  Use to give new instructions or request mid-task updates.

list_children — List all child sessions with status.
  Returns: children with { sessionId, workingDir, status }
  status: "idle"|"tooling"|"waiting"

send_to_parent — [SUB-AGENT ONLY] Report completion back to parent in REAL TIME.
  Params: message (summary + output file manifest)
  Delivery: Uses prompt/steer/followUp based on parent state so results arrive immediately.
  Example: agent_tool(action="send_to_parent", message="✓ DONE. Files: DESIGN.md (2KB), index.html (4KB)")

=== PATTERNS ===

PARALLEL: Create N sub-agents without waiting. Each reports via send_to_parent when done. Parent simply waits for results.
SERIAL: Create sub-agent, wait for send_to_parent report, create next dependent sub-agent.

=== RULES ===
- Sub-agents: ALWAYS call send_to_parent with file manifest when task is complete
- Parent: default behavior is to wait for sub-agents to proactively report via send_to_parent. Only use list_children or send_to_sub_agent when the user explicitly asks for status or when you need to send new instructions to a child.
- CRITICAL: After calling create_sub_agent, end your current turn immediately. Do NOT wait, poll, or call list_children. The sub-agent runs independently and will report back on its own.
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
                `Your task:\n${p.initialPrompt}`;
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
            await entry.session.prompt(p.prompt);
            return ok({ sent: true, sessionId: p.sessionId });
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

          case "send_to_parent": {
            const p = params as any;
            if (!p.message) return fail("message required — include summary and output file paths");
            const parentEntry = serverSessionManager.getParentEntry(mySessionId);
            if (!parentEntry?.session?.session) {
              console.error(
                `[AgentTool] send_to_parent FAILED: myId=${mySessionId} parent not found in registry`
              );
              return fail(`Parent not active. Your session: ${mySessionId}`);
            }

            // Safety: verify the parent actually knows this child
            const children = serverSessionManager.getChildren(parentEntry.shortId);
            const isKnown = children.some((c) => c.shortId === mySessionId);
            if (!isKnown) {
              console.error(
                `[AgentTool] send_to_parent CROSS-TALK: myId=${mySessionId} claimed parent=${parentEntry.shortId} but parent doesn't list me as child. Known children: ${children.map((c) => c.shortId).join(",") || "none"}`
              );
              // Try to find the actual parent by searching all sessions
              const allSessions = serverSessionManager.getAllSessions();
              for (const s of allSessions) {
                if (s.shortId === parentEntry.shortId) continue;
                const sChildren = serverSessionManager.getChildren(s.shortId);
                if (sChildren.some((c) => c.shortId === mySessionId)) {
                  console.error(`[AgentTool] Found real parent: ${s.shortId}`);
                }
              }
            }

            const parentSession = parentEntry.session;
            const reportText =
              `[SUB-AGENT REPORT from ${mySessionId}]\n` +
              `This message was sent by a sub-agent via agent_tool(action="send_to_parent").\n` +
              `Task completed. Details:\n\n${p.message}`;

            // 1) Queue the report via followUp() — always safe.
            await parentSession.followUp(reportText);

            // 2) Wake up the parent if it has finished (agent_end has fired).
            //    Bypass PiAgentSession.prompt() and call the SDK directly so
            //    the SDK can throw "already processing" if parent is still
            //    running. Going through PiAgentSession would silently steer
            //    instead, which breaks parallel tool execution.
            try {
              await (parentSession.session as any).prompt(reportText);
              return ok({ sent: true, toParent: parentEntry.shortId, method: "followUp+prompt" });
            } catch (e: any) {
              if (e.message?.includes("already processing")) {
                // Parent is still running — followUp will be consumed when its loop finishes.
                return ok({ sent: true, toParent: parentEntry.shortId, method: "followUp" });
              }
              throw e;
            }
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
