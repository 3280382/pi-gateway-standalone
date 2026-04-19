/**
 * LoadingScreen - Application loading page
 */

import styles from "@/app/App.module.css";

export function LoadingScreen() {
  return (
    <div className={styles.loading}>
      <div className={styles.spinner} />
      <p>Loading...</p>
    </div>
  );
}
