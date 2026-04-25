/**
 * AgentsPage - Agent management page
 * Follows KeepAlive pattern from ChatPage/FilesPage
 */

import { useCallback, useEffect, useState } from "react";
import { AgentList } from "./components/AgentList";
import { AgentForm } from "./components/AgentForm";
import { useAgentStore } from "./stores/agentStore";
import type { Agent } from "./types";
import styles from "./components/Agents.module.css";

export function AgentsPage() {
  const { loadAgents, setEditingAgent, editingAgent, isFormOpen, setFormOpen } = useAgentStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      loadAgents();
      setInitialized(true);
    }
  }, [loadAgents, initialized]);

  const handleAdd = useCallback(() => {
    setEditingAgent(null);
    setFormOpen(true);
  }, [setEditingAgent, setFormOpen]);

  const handleEdit = useCallback(
    (agent: Agent) => {
      setEditingAgent(agent);
      setFormOpen(true);
    },
    [setEditingAgent, setFormOpen]
  );

  const handleCloseForm = useCallback(() => {
    setFormOpen(false);
    setEditingAgent(null);
  }, [setFormOpen, setEditingAgent]);

  return (
    <div className={styles.page}>
      <AgentList onEdit={handleEdit} onAdd={handleAdd} />
      {isFormOpen && <AgentForm agent={editingAgent} onClose={handleCloseForm} />}
    </div>
  );
}

export default AgentsPage;
