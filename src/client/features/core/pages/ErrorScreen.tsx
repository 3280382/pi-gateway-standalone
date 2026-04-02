/**
 * ErrorScreen - 应用错误页面
 */

import styles from "./PageStyles.module.css";

interface ErrorScreenProps {
	error: string;
	onRetry: () => void;
}

export function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
	return (
		<div className={styles.errorScreen}>
			<h2 className={styles.errorTitle}>Error</h2>
			<pre className={styles.errorMessage}>{error}</pre>
			<button onClick={onRetry} className={styles.retryButton}>
				Retry
			</button>
		</div>
	);
}
