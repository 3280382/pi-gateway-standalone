/**
 * LoadingScreen - 应用加载页面
 */

import styles from "./PageStyles.module.css";

export function LoadingScreen() {
	return (
		<div className={styles.loadingScreen}>
			<div className={styles.loadingLogo}>π</div>
			<div className={styles.loadingText}>Initializing Pi Gateway...</div>
			<div className={styles.loadingBar}>
				<div className={styles.loadingProgress} />
			</div>
		</div>
	);
}
