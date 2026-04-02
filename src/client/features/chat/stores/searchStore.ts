/**
 * Search Store - 消息搜索状态
 */

import { create } from "zustand";

export interface SearchResult {
	messageId: string;
	indices: number[];
	preview: string;
}

export interface SearchFilters {
	user: boolean;
	assistant: boolean;
	thinking: boolean;
	tools: boolean;
}

export interface SearchState {
	query: string;
	results: SearchResult[];
	currentIndex: number;
	filters: SearchFilters;
	isSearching: boolean;
}

interface SearchActions {
	setQuery: (query: string) => void;
	setFilters: (filters: Partial<SearchFilters>) => void;
	setResults: (results: SearchResult[]) => void;
	nextResult: () => void;
	prevResult: () => void;
	clearSearch: () => void;
}

export const useSearchStore = create<SearchState & SearchActions>()(
	(set, get) => ({
		query: "",
		results: [],
		currentIndex: -1,
		filters: {
			user: true,
			assistant: true,
			thinking: true,
			tools: true,
		},
		isSearching: false,

		setQuery: (query) => set({ query, isSearching: !!query }),

		setFilters: (filters) =>
			set((state) => ({
				filters: { ...state.filters, ...filters },
			})),

		setResults: (results) =>
			set({
				results,
				currentIndex: results.length > 0 ? 0 : -1,
				isSearching: false,
			}),

		nextResult: () => {
			const { results, currentIndex } = get();
			if (results.length === 0) return;
			set({ currentIndex: (currentIndex + 1) % results.length });
		},

		prevResult: () => {
			const { results, currentIndex } = get();
			if (results.length === 0) return;
			set({
				currentIndex: (currentIndex - 1 + results.length) % results.length,
			});
		},

		clearSearch: () =>
			set({
				query: "",
				results: [],
				currentIndex: -1,
				isSearching: false,
			}),
	}),
);
