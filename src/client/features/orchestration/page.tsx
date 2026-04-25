/**
 * OrchestrationPage - Main orchestration page
 */
import { useEffect, useRef } from "react";
import { OrchBottomMenu } from "./components/OrchBottomMenu";
import { OrchItemList } from "./components/OrchItemList";
import { ContentEditor } from "./components/ContentEditor";
import { AgentForm } from "@/features/agents/components/AgentForm";
import { ModelsEditor } from "./components/ModelsEditor";
import { useOrchStore } from "./stores/orchStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import styles from "./components/Orch.module.css";

export function OrchestrationPage() {
  const { loadItems, view, editorType, isEditorOpen, editingItem, closeEditor } = useOrchStore();
  const workingDir = useSessionStore((s) => s.workingDir);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      loadItems(workingDir);
      initialized.current = true;
    }
  }, [loadItems, workingDir]);

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <OrchItemList />
      </div>

      <OrchBottomMenu />

      {/* Agents: use full AgentForm */}
      {editorType === "agent" && isEditorOpen && (
        <AgentForm agent={view === "agents" ? (editingItem as any) : null} onClose={closeEditor} />
      )}

      {/* Prompts/Skills/Workflows: use ContentEditor */}
      {editorType === "content" && isEditorOpen && <ContentEditor />}

      {/* Models: use ModelsEditor */}
      {editorType === "model" && isEditorOpen && <ModelsEditor />}
    </div>
  );
}

export default OrchestrationPage;
