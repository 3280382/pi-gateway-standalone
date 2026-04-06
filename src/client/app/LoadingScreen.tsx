/**
 * LoadingScreen - 应用加载中页面
 */

import styles from "@/app/App.module.css";

export function LoadingScreen() {
	return (
		<div className={styles.loading}>
			<div className={styles.spinner} />
			<p>加载中...</p>
		</div>
	);
}
