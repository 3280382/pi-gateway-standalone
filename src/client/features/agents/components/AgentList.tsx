/**
 * AgentList - Agent management list
 */

import { useCallback } from "react";
import { useAgentStore } from "../stores/agentStore";
import type { Agent } from "../types";
import styles from "./Agents.module.css";

interface AgentListProps {
  onEdit: (agent: Agent) => void;
  onAdd: () => void;
}

export function AgentList({ onEdit, onAdd }: AgentListProps) {
  const { agents, removeAgent, isLoading } = useAgentStore();

  const handleDelete = useCallback(
    async (agent: Agent) => {
      if (confirm(`Delete agent "${agent.name}"?`)) await removeAgent(agent.id);
    },
    [removeAgent]
  );

  if (isLoading && agents.length === 0) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.listContainer}>
      <div className={styles.listHeader}>
        <h2 className={styles.pageTitle}>Agents</h2>
        <button type="button" className={styles.addBtn} onClick={onAdd}>
          + New
        </button>
      </div>

      {agents.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No agents defined yet.</p>
          <p className={styles.emptyHint}>
            Create agents to customize AI behavior for different tasks.
          </p>
        </div>
      ) : (
        <div className={styles.agentCards}>
          {agents.map((agent) => (
            <div key={agent.id} className={styles.agentCard}>
              <div className={styles.agentCardHeader}>
                <div className={styles.agentInfo}>
                  <h3 className={styles.agentName}>{agent.name}</h3>
                  <span className={styles.agentModel}>
                    {agent.defaultProvider}/{agent.defaultModel}
                  </span>
                </div>
                <div className={styles.agentActions}>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => onEdit(agent)}
                    title="Edit"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                    onClick={() => handleDelete(agent)}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {agent.description && <p className={styles.agentDesc}>{agent.description}</p>}
              <div className={styles.agentMeta}>
                <span className={styles.metaTag}>Think: {agent.thinkingLevel}</span>
                <span className={styles.metaTag}>Tools: {agent.tools?.join(", ") || "all"}</span>
                {agent.skillNames?.length > 0 && (
                  <span className={styles.metaTag}>Skills: {agent.skillNames.length}</span>
                )}
                {agent.promptTemplateNames?.length > 0 && (
                  <span className={styles.metaTag}>
                    Templates: {agent.promptTemplateNames.length}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
