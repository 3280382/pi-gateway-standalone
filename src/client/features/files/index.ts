/**
 * Files Feature - 文件功能模块
 */

// Components
export { FileBrowser } from "./components/FileBrowser";
export { FileGrid } from "./components/FileGrid";
export { FileList } from "./components/FileList";
export { FileItem } from "./components/FileItem";
export { FileSidebar } from "./components/FileSidebar";
export { BatchActionBar } from "./components/BatchActionBar";

// Layout & Page
export { FilesLayout } from "./layout";
export { FilesPage } from "./page";

// Re-export from global stores
export { useFileStore } from "@/stores/fileStore";
