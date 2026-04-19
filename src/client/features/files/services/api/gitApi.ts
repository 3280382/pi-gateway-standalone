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
 * 获取files的 Git 历史
 */
export async function history(filePath: string, workingDir: string): Promise<GitCommit[]> {
  const response = await fetchApi<GitHistoryResponse>(
    `/files/git/history?filePath=${encodeURIComponent(filePath)}&workingDir=${encodeURIComponent(workingDir)}`
  );
  return response.history;
}

/**
 * 获取指定版本的files内容
 */
export async function content(
  filePath: string,
  commitHash: string,
  workingDir: string
): Promise<string> {
  const response = await fetchApi<GitContentResponse>(
    `/files/git/content?filePath=${encodeURIComponent(filePath)}&commitHash=${encodeURIComponent(commitHash)}&workingDir=${encodeURIComponent(workingDir)}`
  );
  return response.content;
}

/**
 * 获取指定版本与当前版本的 diff
 */
export async function diff(
  filePath: string,
  commitHash: string,
  workingDir: string
): Promise<string> {
  const response = await fetchApi<GitDiffResponse>(
    `/files/git/diff?filePath=${encodeURIComponent(filePath)}&commitHash=${encodeURIComponent(commitHash)}&workingDir=${encodeURIComponent(workingDir)}`
  );
  return response.diff;
}

/**
 * Check if directory is Git repository
 */
export async function check(workingDir: string): Promise<boolean> {
  const response = await fetchApi<GitCheckResponse>(
    `/files/git/check?workingDir=${encodeURIComponent(workingDir)}`
  );
  return response.isGitRepo;
}

/**
 * 获取工作directories下files的 Git 状态
 */
export async function status(workingDir: string): Promise<Record<string, string>> {
  const response = await fetchApi<GitStatusResponse>(
    `/files/git/status?workingDir=${encodeURIComponent(workingDir)}`
  );
  return response.statuses;
}
