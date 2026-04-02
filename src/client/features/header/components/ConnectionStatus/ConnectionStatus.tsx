/**
 * ConnectionStatus - Display connection status with PID
 */

import type { ConnectionStatusProps } from "../../types";
import styles from "./ConnectionStatus.module.css";

export function ConnectionStatus({ status, pid }: ConnectionStatusProps) {
	return (
		<div
			className={styles.status}
			title={`${status}${pid ? ` (PID: ${pid})` : ""}`}
		>
			<span className={`${styles.statusDot} ${styles[status]}`} />
			{pid && <span className={styles.pid}>{pid}</span>}
		</div>
	);
}
