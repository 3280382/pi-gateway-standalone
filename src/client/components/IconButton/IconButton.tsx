/**
 * IconButton - 全局图标按钮组件
 *
 * 职责：
 * - 统一封装带图标的按钮
 * - 支持多种变体：default、primary、ghost、danger
 * - 支持不同尺寸：sm、md、lg
 * - 支持文字 + 图标组合
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon/Icon";
import styles from "./IconButton.module.css";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** 图标名称 */
  icon: IconName;
  /** 按钮文字（可选） */
  label?: string;
  /** 图标位置 */
  iconPosition?: "left" | "right";
  /** 按钮变体 */
  variant?: "default" | "primary" | "ghost" | "danger" | "toggle";
  /** 按钮尺寸 */
  size?: "sm" | "md" | "lg";
  /** 是否激活状态（用于 toggle 变体） */
  isActive?: boolean;
  /** 额外内容（如徽章） */
  suffix?: ReactNode;
}

export function IconButton({
  icon,
  label,
  iconPosition = "left",
  variant = "default",
  size = "md",
  isActive = false,
  suffix,
  className = "",
  disabled,
  title,
  ...props
}: IconButtonProps) {
  const buttonClass = [
    styles.button,
    styles[variant],
    styles[size],
    isActive && styles.active,
    disabled && styles.disabled,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const iconSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "md";

  return (
    <button
      className={buttonClass}
      disabled={disabled}
      title={title}
      {...props}
    >
      {iconPosition === "left" && (
        <Icon name={icon} size={iconSize} className={styles.icon} />
      )}

      {label && <span className={styles.label}>{label}</span>}

      {iconPosition === "right" && (
        <Icon name={icon} size={iconSize} className={styles.icon} />
      )}

      {suffix && <span className={styles.suffix}>{suffix}</span>}
    </button>
  );
}

/**
 * IconToggleButton - 带切换状态的图标按钮
 */
interface IconToggleButtonProps extends Omit<IconButtonProps, "variant"> {
  /** 激活状态图标 */
  activeIcon: IconName;
  /** 非激活状态图标 */
  inactiveIcon: IconName;
  /** 当前是否激活 */
  isActive: boolean;
}

export function IconToggleButton({
  activeIcon,
  inactiveIcon,
  isActive,
  ...props
}: IconToggleButtonProps) {
  return (
    <IconButton
      icon={isActive ? activeIcon : inactiveIcon}
      variant="toggle"
      isActive={isActive}
      {...props}
    />
  );
}

/**
 * IconMenuItem - 用于下拉菜单的图标项
 */
interface IconMenuItemProps
  extends Omit<IconButtonProps, "variant" | "size"> {
  /** 是否显示选中标记 */
  checked?: boolean;
}

export function IconMenuItem({
  checked = false,
  suffix,
  ...props
}: IconMenuItemProps) {
  return (
    <IconButton
      variant="ghost"
      size="sm"
      suffix={
        checked ? <Icon name="check" size="sm" className={styles.check} /> : suffix
      }
      {...props}
    />
  );
}
