/**
 * SearchBox - Message search with filters
 */

import { useState } from "react";
import type { SearchBoxProps, SearchFilters } from "../../types";
import styles from "./SearchBox.module.css";

// Icons
function SearchIcon({ className }: { className?: string }) {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
			<circle cx="11" cy="11" r="8" />
			<line x1="21" y1="21" x2="16.65" y2="16.65" />
		</svg>
	);
}

function XIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	);
}

function FilterIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
			<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
		</svg>
	);
}

function CheckIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
			<polyline points="20 6 9 17 4 12" />
		</svg>
	);
}

interface FilterChipProps {
	label: string;
	checked: boolean;
	onChange: () => void;
}

function FilterChip({ label, checked, onChange }: FilterChipProps) {
	return (
		<button className={`${styles.filterChip} ${checked ? styles.checked : ""}`} onClick={onChange}>
			{checked && <CheckIcon />}
			<span>{label}</span>
		</button>
	);
}

export function SearchBox({ query, filters, onQueryChange, onFiltersChange }: SearchBoxProps) {
	const [showFilters, setShowFilters] = useState(false);

	const handleFilterChange = (key: keyof SearchFilters) => {
		onFiltersChange({ ...filters, [key]: !filters[key] });
	};

	const hasActiveFilters = filters.user || filters.assistant || filters.thinking || filters.tools;
	const activeFilterCount = [filters.user, filters.assistant, filters.thinking, filters.tools].filter(Boolean).length;

	return (
		<div className={styles.container}>
			<div className={styles.searchWrapper}>
				<SearchIcon className={styles.searchIcon} />
				<input
					type="text"
					className={styles.input}
					placeholder="Search messages..."
					value={query}
					onChange={(e) => onQueryChange(e.target.value)}
				/>
				{query && (
					<button className={styles.clearBtn} onClick={() => onQueryChange("")} title="Clear">
						<XIcon />
					</button>
				)}
				<button
					className={`${styles.filterToggle} ${hasActiveFilters ? styles.active : ""} ${showFilters ? styles.expanded : ""}`}
					onClick={() => setShowFilters(!showFilters)}
					title="Toggle Filters"
				>
					<FilterIcon />
					{hasActiveFilters && <span className={styles.filterCount}>{activeFilterCount}</span>}
				</button>
			</div>
			{showFilters && (
				<div className={styles.filterDropdown}>
					<FilterChip label="User" checked={filters.user} onChange={() => handleFilterChange("user")} />
					<FilterChip label="Assistant" checked={filters.assistant} onChange={() => handleFilterChange("assistant")} />
					<FilterChip label="Thinking" checked={filters.thinking} onChange={() => handleFilterChange("thinking")} />
					<FilterChip label="Tools" checked={filters.tools} onChange={() => handleFilterChange("tools")} />
				</div>
			)}
		</div>
	);
}
