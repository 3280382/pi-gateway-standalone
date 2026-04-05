/**
 * SectionHeader - Shared UI Component
 */

import type { SectionHeaderProps } from "@/types/sidebar";
import styles from "./SectionHeader.module.css";

export function SectionHeader({ title, action }: SectionHeaderProps) {
	return (
		<div className={styles.header}>
			<span className={styles.title}>{title}</span>
			{action && <div className={styles.action}>{action}</div>}
		</div>
	);
}
