/**
 * LLM Log Store - LLM日志设置
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LlmLogState {
	enabled: boolean;
	refreshInterval: number;
	truncate: boolean;
	truncateSize: number;
}

interface LlmLogActions {
	setEnabled: (enabled: boolean) => void;
	setRefreshInterval: (interval: number) => void;
	setTruncate: (truncate: boolean) => void;
	setTruncateSize: (size: number) => void;
}

export const useLlmLogStore = create<LlmLogState & LlmLogActions>()(
	persist(
		(set) => ({
			enabled: true,
			refreshInterval: 5,
			truncate: false,
			truncateSize: 5000,

			setEnabled: (enabled) => set({ enabled }),
			setRefreshInterval: (refreshInterval) => set({ refreshInterval }),
			setTruncate: (truncate) => set({ truncate }),
			setTruncateSize: (truncateSize) => set({ truncateSize }),
		}),
		{
			name: "llm-log-settings",
		},
	),
);
