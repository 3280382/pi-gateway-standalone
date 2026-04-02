import type React from "react";
import styles from "./Button.module.css";

export type ButtonVariant =
	| "primary"
	| "secondary"
	| "outline"
	| "ghost"
	| "danger"
	| "success";
export type ButtonSize = "small" | "medium" | "large";

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
	fullWidth?: boolean;
	icon?: React.ReactNode;
	iconPosition?: "left" | "right";
}

export const Button: React.FC<ButtonProps> = ({
	children,
	variant = "primary",
	size = "medium",
	loading = false,
	fullWidth = false,
	icon,
	iconPosition = "left",
	className = "",
	disabled,
	...props
}) => {
	const buttonClass = [
		styles.button,
		styles[`variant-${variant}`],
		styles[`size-${size}`],
		fullWidth ? styles.fullWidth : "",
		loading ? styles.loading : "",
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<button className={buttonClass} disabled={disabled || loading} {...props}>
			{loading && (
				<span className={styles.loadingSpinner}>
					<svg className={styles.spinner} viewBox="0 0 50 50">
						<circle
							className={styles.spinnerPath}
							cx="25"
							cy="25"
							r="20"
							fill="none"
							strokeWidth="5"
						/>
					</svg>
				</span>
			)}
			{icon && iconPosition === "left" && !loading && (
				<span className={styles.iconLeft}>{icon}</span>
			)}
			<span className={styles.content}>{children}</span>
			{icon && iconPosition === "right" && !loading && (
				<span className={styles.iconRight}>{icon}</span>
			)}
		</button>
	);
};

// Icon Button variant
export const IconButton: React.FC<Omit<ButtonProps, "iconPosition">> = (
	props,
) => (
	<Button
		{...props}
		variant={props.variant || "ghost"}
		size={props.size || "small"}
		className={`${styles.iconButton} ${props.className || ""}`}
	/>
);
