/**
 * Git API Service - Git History API 客户端
 */

import { fetchApi } from "@/services/client";

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  timestamp: number;
}

export interface GitHistoryResponse {
  history: GitCommit[];
}

export interface GitContentResponse {
  content: string;
}

export interface GitDiffResponse {
  diff: string;
}

export interface GitCheckResponse {
  isGitRepo: boolean;
}

export interface GitStatusResponse {
  statuses: Record<string, string>;
}

/**
 * 获取文件的 Git 历史
 */
export async function getGitHistory(
  filePath: string,
  workingDir: string,
): Promise<GitCommit[]> {
  const response = await fetchApi<GitHistoryResponse>(
    `/git/history?filePath=${encodeURIComponent(filePath)}&workingDir=${encodeURIComponent(workingDir)}`,
  );
  return response.history;
}

/**
 * 获取指定版本的文件内容
 */
export async function getGitContent(
  filePath: string,
  commitHash: string,
  workingDir: string,
): Promise<string> {
  const response = await fetchApi<GitContentResponse>(
    `/git/content?filePath=${encodeURIComponent(filePath)}&commitHash=${encodeURIComponent(commitHash)}&workingDir=${encodeURIComponent(workingDir)}`,
  );
  return response.content;
}

/**
 * 获取指定版本与当前版本的 diff
 */
export async function getGitDiff(
  filePath: string,
  commitHash: string,
  workingDir: string,
): Promise<string> {
  const response = await fetchApi<GitDiffResponse>(
    `/git/diff?filePath=${encodeURIComponent(filePath)}&commitHash=${encodeURIComponent(commitHash)}&workingDir=${encodeURIComponent(workingDir)}`,
  );
  return response.diff;
}

/**
 * 检查目录是否是 Git 仓库
 */
export async function checkGitRepo(workingDir: string): Promise<boolean> {
  const response = await fetchApi<GitCheckResponse>(
    `/git/check?workingDir=${encodeURIComponent(workingDir)}`,
  );
  return response.isGitRepo;
}

/**
 * 获取工作目录下文件的 Git 状态
 */
export async function getGitStatus(workingDir: string): Promise<Record<string, string>> {
  const response = await fetchApi<GitStatusResponse>(
    `/git/status?workingDir=${encodeURIComponent(workingDir)}`,
  );
  return response.statuses;
}
