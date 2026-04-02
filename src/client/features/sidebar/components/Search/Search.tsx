/**
 * Search Section
 */

import { useSidebarController } from "@/services/api/sidebarApi";
import { useSidebarStore } from "@/stores/sidebarStore";
import { IconButton, SectionHeader } from "@/shared/components/ui";
import styles from "./Search.module.css";

export function Search() {
	const searchQuery = useSidebarStore((state) => state.searchQuery);
	const filters = useSidebarStore((state) => state.searchFilters);
	const controller = useSidebarController();

	const handleClear = () => {
		controller.setSearchQuery("");
	};

	const handleFilterChange = (key: keyof typeof filters) => {
		controller.setSearchFilters({ [key]: !filters[key] });
	};

	return (
		<section className={styles.section}>
			<SectionHeader
				title="Search Messages"
				action={
					searchQuery && (
						<IconButton onClick={handleClear} title="Clear Search">
							<XIcon />
						</IconButton>
					)
				}
			/>
			<div className={styles.inputWrapper}>
				<SearchIcon className={styles.searchIcon} />
				<input
					type="text"
					className={styles.input}
					placeholder="Search messages..."
					value={searchQuery}
					onChange={(e) => controller.setSearchQuery(e.target.value)}
				/>
			</div>
			<div className={styles.filters}>
				<FilterLabel
					label="User"
					checked={filters.user}
					onChange={() => handleFilterChange("user")}
				/>
				<FilterLabel
					label="Assistant"
					checked={filters.assistant}
					onChange={() => handleFilterChange("assistant")}
				/>
				<FilterLabel
					label="Thinking"
					checked={filters.thinking}
					onChange={() => handleFilterChange("thinking")}
				/>
				<FilterLabel
					label="Tools"
					checked={filters.tools}
					onChange={() => handleFilterChange("tools")}
				/>
			</div>
		</section>
	);
}

function FilterLabel({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: () => void;
}) {
	return (
		<label className={styles.filterLabel}>
			<input
				type="checkbox"
				checked={checked}
				onChange={onChange}
				className={styles.checkbox}
			/>
			<span>{label}</span>
		</label>
	);
}

function SearchIcon({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			className={className}
		>
			<circle cx="11" cy="11" r="8" />
			<line x1="21" y1="21" x2="16.65" y2="16.65" />
		</svg>
	);
}

function XIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}
