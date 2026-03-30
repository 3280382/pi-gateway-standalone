import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": resolve(__dirname, "src/client"),
			"@shared": resolve(__dirname, "src/shared"),
			"@server": resolve(__dirname, "src/server"),
		},
	},
	build: {
		outDir: "dist",
	},
	server: {
		port: 5173,
		proxy: {
			"/api": {
				target: "http://localhost:3000",
				changeOrigin: true,
			},
			"/ws": {
				target: "ws://localhost:3000",
				ws: true,
			},
		},
	},
});
