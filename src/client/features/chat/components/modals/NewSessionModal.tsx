/**
 * NewSessionModal - "New Session" popup with agent and directory selection
 * Mobile-friendly compact modal
 */

import { useCallback, useEffect, useState } from "react";
import { useAgentStore } from "@/features/agents/stores/agentStore";
import type { Agent } from "@/features/agents/types";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import styles from "./NewSessionModal.module.css";

interface NewSessionModalProps {
  onClose: () => void;
  onDefaultNew: () => void;
  onCustomNew: (agentId: string, workingDir: string, sessionName: string) => void;
}

export function NewSessionModal({ onClose, onDefaultNew, onCustomNew }: NewSessionModalProps) {
  const { agents, loadAgents, isLoading } = useAgentStore();
  const workingDir = useSessionStore((s) => s.workingDir);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [customWorkingDir, setCustomWorkingDir] = useState(workingDir || "");
  const [sessionName, setSessionName] = useState("");
  const [showCustomFields, setShowCustomFields] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      loadAgents();
      setInitialized(true);
    }
  }, [loadAgents, initialized]);

  useEffect(() => {
    if (workingDir && !customWorkingDir) {
      setCustomWorkingDir(workingDir);
    }
  }, [workingDir, customWorkingDir]);

  const handleDefaultNew = useCallback(() => {
    onDefaultNew();
    onClose();
  }, [onDefaultNew, onClose]);

  const handleCustomNew = useCallback(() => {
    if (selectedAgentId && customWorkingDir) {
      onCustomNew(selectedAgentId, customWorkingDir, sessionName);
      onClose();
    }
  }, [selectedAgentId, customWorkingDir, sessionName, onCustomNew, onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h3 className={styles.title}>New Session</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Options */}
        <div className={styles.body}>
          {/* Default New */}
          <button type="button" className={styles.optionBtn} onClick={handleDefaultNew}>
            <div className={styles.optionContent}>
              <span className={styles.optionIcon}>⚡</span>
              <div className={styles.optionText}>
                <span className={styles.optionTitle}>Default New</span>
                <span className={styles.optionDesc}>Use current directory and default agent</span>
              </div>
            </div>
            <span className={styles.arrow}>→</span>
          </button>

          {/* Custom New - Toggle */}
          <button
            type="button"
            className={`${styles.optionBtn} ${showCustomFields ? styles.active : ""}`}
            onClick={() => setShowCustomFields(!showCustomFields)}
          >
            <div className={styles.optionContent}>
              <span className={styles.optionIcon}>🎯</span>
              <div className={styles.optionText}>
                <span className={styles.optionTitle}>Custom New</span>
                <span className={styles.optionDesc}>Choose agent and working directory</span>
              </div>
            </div>
            <span className={styles.expandIcon}>{showCustomFields ? "▲" : "▼"}</span>
          </button>

          {/* Custom Fields */}
          {showCustomFields && (
            <div className={styles.customFields}>
              {/* Agent Selection */}
              <label className={styles.fieldLabel}>
                Agent
                <select
                  className={styles.select}
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                >
                  <option value="">-- Select agent --</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.defaultProvider}/{agent.defaultModel})
                    </option>
                  ))}
                </select>
              </label>

              {/* Session Name */}
              <label className={styles.fieldLabel}>
                Session Name (optional)
                <input
                  className={styles.input}
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="My session..."
                />
              </label>

              {/* Working Directory */}
              <label className={styles.fieldLabel}>
                Working Directory
                <input
                  className={styles.input}
                  value={customWorkingDir}
                  onChange={(e) => setCustomWorkingDir(e.target.value)}
                  placeholder="/path/to/project"
                />
              </label>

              {/* Create Button */}
              <button
                type="button"
                className={styles.createBtn}
                onClick={handleCustomNew}
                disabled={!selectedAgentId || !customWorkingDir}
              >
                Create with Agent
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
