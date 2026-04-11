/**
 * useImageUpload - 图片上传处理 Hook
 *
 * 职责：
 * - 管理图片上传状态
 * - 处理文件选择和 base64 转换
 * - 执行 OCR 文本识别
 */

import { useCallback, useState } from "react";

export interface ImageUpload {
  id: string;
  file: File;
  preview: string;
  base64: string;
  mimeType: string;
  ocrText?: string;
  isProcessingOCR: boolean;
}

export interface UseImageUploadReturn {
  // 状态
  images: ImageUpload[];
  showPreview: boolean;

  // 操作
  addImages: (files: FileList | null) => void;
  removeImage: (id: string) => void;
  clearImages: () => void;
  togglePreview: () => void;
  showPreviewBar: () => void;
  hidePreviewBar: () => void;
  getImagesForUpload: () => Array<{
    type: "image";
    source: { type: "base64"; mediaType: string; data: string };
  }>;
}

// OCR API 调用
async function performOCR(base64Image: string, mimeType: string): Promise<string> {
  try {
    const response = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Image, mimeType }),
    });
    if (response.ok) {
      const data = await response.json();
      return data.text || "";
    }
  } catch (err) {
    console.error("[useImageUpload] OCR failed:", err);
  }
  return "";
}

export function useImageUpload(): UseImageUploadReturn {
  const [images, setImages] = useState<ImageUpload[]>([]);
  const [showPreview, setShowPreview] = useState(true);

  // 添加图片
  const addImages = useCallback((files: FileList | null) => {
    if (!files) return;

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const newImage: ImageUpload = {
          id: imageId,
          file,
          preview: base64,
          base64: base64.split(",")[1],
          mimeType: file.type,
          isProcessingOCR: file.type.startsWith("image/"),
        };

        setImages((prev) => [...prev, newImage]);

        // 对图片执行 OCR
        if (file.type.startsWith("image/")) {
          try {
            const ocrText = await performOCR(base64, file.type);
            setImages((prev) =>
              prev.map((img) =>
                img.id === imageId ? { ...img, ocrText, isProcessingOCR: false } : img
              )
            );
          } catch {
            setImages((prev) =>
              prev.map((img) => (img.id === imageId ? { ...img, isProcessingOCR: false } : img))
            );
          }
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // 移除图片
  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  // 清空所有图片
  const clearImages = useCallback(() => {
    setImages([]);
  }, []);

  // 切换预览显示
  const togglePreview = useCallback(() => {
    setShowPreview((prev) => !prev);
  }, []);

  // 显示预览栏
  const showPreviewBar = useCallback(() => {
    setShowPreview(true);
  }, []);

  // 隐藏预览栏
  const hidePreviewBar = useCallback(() => {
    setShowPreview(false);
  }, []);

  // 获取用于上传的图片格式
  const getImagesForUpload = useCallback(() => {
    return images.map((img) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        mediaType: img.mimeType,
        data: img.base64,
      },
    }));
  }, [images]);

  return {
    images,
    showPreview,
    addImages,
    removeImage,
    clearImages,
    togglePreview,
    showPreviewBar,
    hidePreviewBar,
    getImagesForUpload,
  };
}
