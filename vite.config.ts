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
		// 禁用报告压缩大小，加速构建并减少输出
		reportCompressedSize: false,
		// 提高 chunk size 警告限制，避免警告干扰
		chunkSizeWarningLimit: 1000,
		// 确保构建完成后退出，不进入 watch 模式
		watch: null,
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
