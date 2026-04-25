/**
 * OrchItemList - Resource list display based on current view
 */
import { useOrchStore } from "../stores/orchStore";
import type { ResourceItem } from "../services/api";
import styles from "./Orch.module.css";

export function OrchItemList() {
  const { items, view, loading, openEditor, deleteItem } = useOrchStore();

  if (loading) return <div className={styles.loading}>Loading...</div>;

  if (items.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No {view} defined yet.</p>
        <button type="button" className={styles.addBtn} onClick={() => openEditor()}>
          + Create
        </button>
      </div>
    );
  }

  const handleDelete = (item: ResourceItem) => {
    if (confirm(`Delete "${item.name}"?`)) deleteItem(item.id);
  };

  return (
    <div className={styles.itemList}>
      {items.map((item) => (
        <div key={item.id} className={styles.itemCard} onClick={() => openEditor(item)}>
          <div className={styles.itemCardHeader}>
            <div className={styles.itemInfo}>
              <h3 className={styles.itemName}>{item.name}</h3>
              {item.description && <p className={styles.itemDesc}>{item.description}</p>}
            </div>
            <div className={styles.itemActions} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => openEditor(item)}
                title="Edit"
              >
                ✎
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.deleteBtn}`}
                onClick={() => handleDelete(item)}
                title="Delete"
              >
                ✕
              </button>
            </div>
          </div>
          <div className={styles.itemMeta}>
            {view === "agents" && (
              <>
                <span className={styles.metaTag}>
                  {item.defaultProvider}/{item.defaultModel}
                </span>
                <span className={styles.metaTag}>Think: {item.thinkingLevel}</span>
                <span className={styles.metaTag}>
                  Tools: {(item.tools as string[])?.join(", ") || "all"}
                </span>
              </>
            )}
            {view === "models" && <span className={styles.metaTag}>{item.provider}</span>}
            {view === "workflows" && item.workingDir && (
              <span className={styles.metaTag}>📁 {item.workingDir}</span>
            )}
            {view === "prompts" && <span className={styles.metaTag}>{item.source}</span>}
            {view === "skills" && (
              <span className={styles.metaTag}>{item.path?.split("/").pop()}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
