/**
 * FilesPage - 文件页面
 *
 * 职责：页面入口，组合 Hooks 和 Layout
 * - 不包含业务逻辑
 * - 只负责初始化和渲染 Layout
 */

import { useFileBrowser } from "@/features/files/hooks";
import { FilesLayout } from "./layout";

interface FilesPageProps {
	closeBottomPanel: () => void;
	setBottomPanelHeight: (height: number) => void;
}

export function FilesPage(props: FilesPageProps) {
	const { isInitializing } = useFileBrowser();

	return <FilesLayout isInitializing={isInitializing} {...props} />;
}
