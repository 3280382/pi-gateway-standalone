/**
 * CodeMirror 6 语言扩展映射
 * 根据files类型返回对应的语言支持
 */

import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { StreamLanguage } from "@codemirror/language";

// 简单的 shell 语法高亮
const shellLanguage = StreamLanguage.define({
  name: "shell",
  startState: () => ({ inString: false }),
  token: (stream, state: { inString: boolean }) => {
    if (stream.eatSpace()) return null;

    // chars串
    if (!state.inString && (stream.eat('"') || stream.eat("'"))) {
      state.inString = true;
      return "string";
    }
    if (state.inString) {
      if (stream.eat('"') || stream.eat("'")) {
        state.inString = false;
        return "string";
      }
      stream.next();
      return "string";
    }

    // 注释
    if (stream.eat("#")) {
      stream.skipToEnd();
      return "comment";
    }

    // 变量
    if (stream.eat("$")) {
      if (stream.eat("{")) {
        while (!stream.eat("}") && !stream.eol()) stream.next();
      } else {
        stream.eatWhile(/[a-zA-Z0-9_]/);
      }
      return "variableName";
    }

    // 命令/关键字
    if (stream.sol()) {
      stream.eatWhile(/[^\s]/);
      return "keyword";
    }

    stream.next();
    return null;
  },
});

// 简单 Java 语法高亮
const javaLanguage = StreamLanguage.define({
  name: "java",
  startState: () => ({ inString: false }),
  token: (stream, state: { inString: boolean }) => {
    if (stream.eatSpace()) return null;

    if (!state.inString && stream.eat('"')) {
      state.inString = true;
      return "string";
    }
    if (state.inString) {
      if (stream.eat('"')) {
        state.inString = false;
        return "string";
      }
      if (stream.eat("\\")) stream.next();
      else stream.next();
      return "string";
    }

    if (stream.eat("/")) {
      if (stream.eat("/")) {
        stream.skipToEnd();
        return "comment";
      }
    }

    if (
      stream.match(
        /\b(class|public|private|protected|static|void|return|if|else|for|while|import|package|new|this|extends|implements|interface|try|catch|finally|throw|throws|true|false|null)\b/
      )
    ) {
      return "keyword";
    }

    if (
      stream.match(/\b(String|int|boolean|float|double|char|byte|short|long|Object|Class|void)\b/)
    ) {
      return "typeName";
    }

    if (stream.eatWhile(/[a-zA-Z_]/)) return "variable";
    if (stream.eatWhile(/[0-9]/)) return "number";

    stream.next();
    return null;
  },
});

// 简单 C/C++ 语法高亮
const cppLanguage = StreamLanguage.define({
  name: "cpp",
  startState: () => ({ inString: false }),
  token: (stream, state: { inString: boolean }) => {
    if (stream.eatSpace()) return null;

    if (!state.inString && stream.eat('"')) {
      state.inString = true;
      return "string";
    }
    if (state.inString) {
      if (stream.eat('"')) {
        state.inString = false;
        return "string";
      }
      if (stream.eat("\\")) stream.next();
      else stream.next();
      return "string";
    }

    if (stream.eat("#")) {
      stream.skipToEnd();
      return "meta";
    }

    if (stream.match(/\/\/.*$/)) {
      return "comment";
    }

    if (
      stream.match(
        /\b(int|char|float|double|void|if|else|for|while|return|class|struct|namespace|using|include|define|typedef|const|static|public|private|protected|virtual|new|delete|true|false|null|nullptr)\b/
      )
    ) {
      return "keyword";
    }

    if (stream.eatWhile(/[a-zA-Z_]/)) return "variable";
    if (stream.eatWhile(/[0-9]/)) return "number";

    stream.next();
    return null;
  },
});

// 简单 Go 语法高亮
const goLanguage = StreamLanguage.define({
  name: "go",
  startState: () => ({ inString: false }),
  token: (stream, state: { inString: boolean }) => {
    if (stream.eatSpace()) return null;

    if (!state.inString && stream.eat('"')) {
      state.inString = true;
      return "string";
    }
    if (state.inString) {
      if (stream.eat('"')) {
        state.inString = false;
        return "string";
      }
      stream.next();
      return "string";
    }

    if (stream.match(/\/\/.*$/)) {
      return "comment";
    }

    if (
      stream.match(
        /\b(package|import|func|var|const|type|struct|interface|map|chan|if|else|for|range|return|switch|case|default|go|defer|panic|recover|nil|true|false)\b/
      )
    ) {
      return "keyword";
    }

    if (stream.eatWhile(/[a-zA-Z_]/)) return "variable";
    if (stream.eatWhile(/[0-9]/)) return "number";

    stream.next();
    return null;
  },
});

// 语言扩展映射表
const languageMap: Record<string, () => any> = {
  // JavaScript/TypeScript - 包括 JSX/TSX
  javascript: () => javascript({ jsx: true }),
  typescript: () => javascript({ jsx: true, typescript: true }),
  // JSX/TSX 映射到相应的 parser
  jsx: () => javascript({ jsx: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  json: () => json(),
  html: () => html(),
  css: () => css(),
  python: () => python(),
  markdown: () => markdown(),
  sql: () => sql(),
  xml: () => xml(),
  yaml: () => yaml(),
  rust: () => rust(),
  java: () => javaLanguage,
  cpp: () => cppLanguage,
  c: () => cppLanguage,
  go: () => goLanguage,
  shell: () => shellLanguage,
  bash: () => shellLanguage,
  sh: () => shellLanguage,
  plain: () => [],
};

/**
 * 根据语言标识获取 CodeMirror 语言扩展
 * @param lang 语言标识（如 'javascript', 'python' 等）
 * @returns CodeMirror 扩展
 */
export function getLanguageExtension(lang: string): any {
  const normalizedLang = lang?.toLowerCase() || "plain";
  const extension = languageMap[normalizedLang];
  return extension ? extension() : [];
}

/**
 * 根据files扩展名获取语言标识
 * @param filename files名
 * @returns 语言标识
 */
export function getLanguageFromFilename(filename: string): string {
  if (!filename) return "plain";

  const ext = filename.split(".").pop()?.toLowerCase() || "";

  const extMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    html: "html",
    htm: "html",
    css: "css",
    scss: "css",
    less: "css",
    py: "python",
    md: "markdown",
    sql: "sql",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    rs: "rust",
    java: "java",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    c: "c",
    go: "go",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
  };

  return extMap[ext] || "plain";
}
