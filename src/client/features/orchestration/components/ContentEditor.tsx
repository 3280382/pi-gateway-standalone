/**
 * ContentEditor - Text editor modal for prompts/skills/workflows
 */
import { useEffect, useState } from "react";
import { useOrchStore } from "../stores/orchStore";
import styles from "./Orch.module.css";

export function ContentEditor() {
  const { editingItem, isEditorOpen, closeEditor, createItem, updateItem, error, clearError } =
    useOrchStore();
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setContent("");
    } else {
      setName("");
      setContent("");
    }
  }, [editingItem]);

  // Load content if editing existing item
  useEffect(() => {
    if (!isEditorOpen || !editingItem) return;
    const load = async () => {
      try {
        // Fetch content from API based on view
        const { promptApi, skillApi } = await import("../services/api");
        let result: { content?: string } | null = null;
        if (editingItem.path?.includes("prompts")) result = await promptApi.get(editingItem.name);
        else if (editingItem.path?.includes("skills"))
          result = await skillApi.get(editingItem.name);
        if (result?.content) setContent(result.content);
      } catch {
        /* ignore */
      }
    };
    load();
  }, [isEditorOpen, editingItem]);

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) return;
    setSaving(true);
    try {
      if (editingItem && editingItem.id) await updateItem(editingItem.id, content);
      else await createItem(name, content);
    } finally {
      setSaving(false);
    }
  };

  if (!isEditorOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={closeEditor}>
      <div className={styles.editorContainer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.formHeader}>
          <h2 className={styles.formTitle}>
            {editingItem ? `Edit ${editingItem.name}` : "Create New"}
          </h2>
          <button type="button" className={styles.closeBtn} onClick={closeEditor}>
            ✕
          </button>
        </div>

        <div className={styles.formBody}>
          {!editingItem && (
            <label className={styles.fieldLabel}>
              Name *
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., my-prompt"
              />
            </label>
          )}
          <label className={styles.fieldLabel}>
            Content *
            <textarea
              className={styles.editorTextarea}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Markdown content..."
              rows={15}
            />
          </label>
          {error && (
            <div className={styles.errorMsg}>
              {error}
              <button type="button" className={styles.errorClose} onClick={clearError}>
                ✕
              </button>
            </div>
          )}
        </div>

        <div className={styles.formFooter}>
          <button type="button" className={styles.cancelBtn} onClick={closeEditor}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving || !name.trim() || !content.trim()}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
