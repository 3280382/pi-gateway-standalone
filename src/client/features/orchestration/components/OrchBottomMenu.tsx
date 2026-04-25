/**
 * OrchBottomMenu - Orchestration bottom toolbar
 * Pattern: FileBottomMenu with view switcher + action buttons
 */
import { useRef, useState } from "react";
import { useOrchStore, type OrchView } from "../stores/orchStore";
import styles from "./Orch.module.css";

const VIEWS: { key: OrchView; label: string; icon: string }[] = [
  { key: "agents", label: "Agents", icon: "🤖" },
  { key: "prompts", label: "Prompts", icon: "📋" },
  { key: "skills", label: "Skills", icon: "🛠️" },
  { key: "workflows", label: "Workflows", icon: "⚡" },
  { key: "models", label: "Models", icon: "🧠" },
];

export function OrchBottomMenu() {
  const { view, setView, openEditor, items, deleteItem } = useOrchStore();
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string>("");
  const viewBtnRef = useRef<HTMLButtonElement>(null);

  const currentView = VIEWS.find((v) => v.key === view)!;

  const handleDelete = () => {
    if (items.length === 0) return;
    setDeleteTarget(items[0].id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    await deleteItem(deleteTarget);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div className={styles.bottomMenu}>
        {/* View switcher button (left) */}
        <button
          type="button"
          ref={viewBtnRef}
          className={`${styles.btn} ${styles.viewBtn}`}
          onClick={() => setShowViewMenu(!showViewMenu)}
          title="Switch view"
        >
          <span className={styles.btnIcon}>{currentView.icon}</span>
        </button>

        <div className={styles.divider} />

        {/* View label */}
        <span className={styles.viewLabel}>{currentView.label}</span>

        <div className={styles.spacer} />

        {/* Action buttons */}
        <button
          type="button"
          className={`${styles.btn} ${styles.newBtn}`}
          onClick={() => openEditor()}
          title={`New ${currentView.label.slice(0, -1)}`}
        >
          <PlusIcon />
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.editBtn}`}
          onClick={() => items[0] && openEditor(items[0])}
          title={`Edit ${currentView.label.slice(0, -1)}`}
          disabled={items.length === 0}
        >
          <EditIcon />
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.deleteBtn}`}
          onClick={handleDelete}
          title="Delete"
          disabled={items.length === 0}
        >
          <TrashIcon />
        </button>
      </div>

      {/* View selector popup */}
      {showViewMenu && (
        <>
          <div className={styles.overlay} onClick={() => setShowViewMenu(false)} />
          <div
            className={styles.viewPopup}
            style={{
              position: "fixed",
              bottom: "52px",
              left: viewBtnRef.current?.getBoundingClientRect().left ?? "12px",
            }}
          >
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                className={`${styles.viewOption} ${v.key === view ? styles.active : ""}`}
                onClick={() => {
                  setView(v.key);
                  setShowViewMenu(false);
                }}
              >
                <span>{v.icon}</span> {v.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div className={styles.deleteModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.deleteModalTitle}>🗑️ Confirm Delete</div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={confirmDelete}
                style={{ background: "var(--accent-red)" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
