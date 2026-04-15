/**
 * Files Feature HTTP 路由注册
 * 集中注册所有文件系统相关的 HTTP API 路由
 */

import type { Application } from "express";

/**
 * 注册 Files Feature 的所有 HTTP 路由
 */
export async function registerFilesHTTPRoutes(app: Application): Promise<void> {
  // File controller
  const { browse, tree, content, raw, write, batchDelete, batchMove, execute } = await import(
    "./file/file.controller"
  );

  // Git controller
  const {
    history,
    content: gitContent,
    diff,
    check,
    status,
  } = await import("./git/git.controller");

  // Todo controller
  const { add, list, toggle, getByFile, update } = await import("./todo/todo.controller");

  // File routes - /api/files/file/*
  app.post("/api/files/file/browse", browse);
  app.get("/api/files/file/tree", tree);
  app.get("/api/files/file/content", content);
  app.get("/api/files/file/raw", raw);
  app.post("/api/files/file/write", write);
  app.post("/api/files/file/batch-delete", batchDelete);
  app.post("/api/files/file/batch-move", batchMove);
  app.post("/api/files/file/execute", execute);

  // Git routes - /api/files/git/*
  app.get("/api/files/git/history", history);
  app.get("/api/files/git/content", gitContent);
  app.get("/api/files/git/diff", diff);
  app.get("/api/files/git/check", check);
  app.get("/api/files/git/status", status);

  // Todo routes - /api/files/todo/*
  app.post("/api/files/todo/add", add);
  app.get("/api/files/todo/list", list);
  app.get("/api/files/todo/file", getByFile);
  app.post("/api/files/todo/toggle", toggle);
  app.post("/api/files/todo/update", update);
}
