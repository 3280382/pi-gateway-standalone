/**
 * IconButton - Shared UI Component
 */

import type { IconButtonProps } from '../../../types/sidebar';
import styles from './IconButton.module.css';

export function IconButton({
  onClick,
  title,
  children,
  className = '',
}: IconButtonProps) {
  return (
    <button
      className={`${styles.button} ${className}`}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}
