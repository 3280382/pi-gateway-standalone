/**
 * OCR Controller - 图片OCR识别
 * 用于Chat输入区域的图片文字提取
 */

import type { Request, Response } from "express";

interface OCROptions {
	image: string; // base64 image data
	mimeType: string;
}

/**
 * 处理OCR请求
 */
export async function performOCR(req: Request, res: Response): Promise<void> {
	try {
		const { image, mimeType } = req.body as OCROptions;

		if (!image) {
			res.status(400).json({ error: "Image data is required" });
			return;
		}

		// Check if pi-coding-agent has OCR capabilities via SDK
		// For now, return a placeholder response
		// In production, this should call the actual OCR service

		// Extract base64 data (remove data URL prefix if present)
		const _base64Data = image.includes(",") ? image.split(",")[1] : image;

		// TODO: Integrate with actual OCR service
		// This could be:
		// 1. A local Tesseract.js instance
		// 2. A cloud OCR service (Google Vision, AWS Textract, etc.)
		// 3. The pi-coding-agent SDK if it has OCR capabilities

		res.json({
			success: true,
			text: "", // Empty for now - will be populated by actual OCR
			message: "OCR endpoint ready - integrate with your preferred OCR service",
		});
	} catch (error) {
		console.error("[OCR] Error:", error);
		res.status(500).json({
			error: error instanceof Error ? error.message : "OCR processing failed",
		});
	}
}
