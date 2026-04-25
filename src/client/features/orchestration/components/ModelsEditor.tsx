/**
 * ModelsEditor - Edit models.json with JSON text editor + add/restore
 */
import { useEffect, useState } from "react";
import { useOrchStore } from "../stores/orchStore";
import { fetchApi } from "@/services/client";
import styles from "./Orch.module.css";

export function ModelsEditor() {
  const { closeEditor, loadItems, error: storeError, clearError } = useOrchStore();
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addProvider, setAddProvider] = useState("");
  const [addModelId, setAddModelId] = useState("");
  const [addModelName, setAddModelName] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchApi<{ content: string }>("/orchestration/models/raw");
        setContent(JSON.stringify(JSON.parse(res.content), null, 2));
      } catch {
        setContent('{\n  "providers": {}\n}');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!content.trim()) return;
    try {
      JSON.parse(content);
    } catch {
      setLocalError("Invalid JSON");
      return;
    }
    setSaving(true);
    setLocalError("");
    try {
      await fetchApi("/orchestration/models/raw", {
        method: "PUT",
        body: JSON.stringify({ content }),
      });
      await loadItems();
      closeEditor();
    } catch (e: any) {
      setLocalError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleAddModel = async () => {
    if (!addProvider.trim() || !addModelId.trim()) return;
    setSaving(true);
    setLocalError("");
    try {
      await fetchApi("/orchestration/models/add", {
        method: "POST",
        body: JSON.stringify({
          provider: addProvider.trim(),
          modelId: addModelId.trim(),
          name: addModelName.trim() || addModelId.trim(),
        }),
      });
      setAddProvider("");
      setAddModelId("");
      setAddModelName("");
      // Reload content
      const res = await fetchApi<{ content: string }>("/orchestration/models/raw");
      setContent(JSON.stringify(JSON.parse(res.content), null, 2));
      await loadItems();
    } catch (e: any) {
      setLocalError(e.message || "Add failed");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading)
    return (
      <div className={styles.modalOverlay}>
        <div className={styles.loading}>Loading models...</div>
      </div>
    );

  return (
    <div className={styles.modalOverlay} onClick={closeEditor}>
      <div
        className={styles.editorContainer}
        style={{ maxWidth: "520px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.formHeader}>
          <h2 className={styles.formTitle}>Edit models.json</h2>
          <button type="button" className={styles.closeBtn} onClick={closeEditor}>
            ✕
          </button>
        </div>

        <div className={styles.formBody}>
          {/* Quick Add */}
          <fieldset className={styles.checkboxGroup}>
            <legend className={styles.fieldLabel}>Quick Add Model</legend>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input
                className={styles.input}
                style={{ flex: 1, minWidth: 80 }}
                placeholder="Provider"
                value={addProvider}
                onChange={(e) => setAddProvider(e.target.value)}
              />
              <input
                className={styles.input}
                style={{ flex: 1, minWidth: 80 }}
                placeholder="Model ID"
                value={addModelId}
                onChange={(e) => setAddModelId(e.target.value)}
              />
              <input
                className={styles.input}
                style={{ flex: 1, minWidth: 80 }}
                placeholder="Name (opt)"
                value={addModelName}
                onChange={(e) => setAddModelName(e.target.value)}
              />
              <button
                type="button"
                className={styles.saveBtn}
                onClick={handleAddModel}
                disabled={saving}
                style={{ whiteSpace: "nowrap" }}
              >
                Add
              </button>
            </div>
          </fieldset>

          {/* JSON Editor */}
          <label className={styles.fieldLabel}>
            Raw JSON
            <textarea
              className={styles.editorTextarea}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={18}
              spellCheck={false}
              style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
            />
          </label>

          {(localError || storeError) && (
            <div className={styles.errorMsg}>
              {localError || storeError}
              <button
                type="button"
                className={styles.errorClose}
                onClick={() => {
                  setLocalError("");
                  clearError();
                }}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <div className={styles.formFooter}>
          <span style={{ fontSize: 10, color: "var(--text-muted)", marginRight: "auto" }}>
            Backup auto-created on each save to ~/.pi/agent/backups/
          </span>
          <button type="button" className={styles.cancelBtn} onClick={closeEditor}>
            Cancel
          </button>
          <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
