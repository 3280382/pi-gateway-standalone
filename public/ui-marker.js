// React UI Marker v2.0
// 单文件，零依赖，原生 ES6+
// 文档: react-ui-marker-spec-v2.md

(function () {
  "use strict";

  // ============================================
  // 类型定义（仅用于文档）
  // ============================================
  /**
   * @typedef {Object} Marker
   * @property {string} id
   * @property {string} label
   * @property {HTMLElement} element
   * @property {DOMRect} rect
   */

  /**
   * @typedef {Object} ElementContext
   * @property {Object} dom
   * @property {string} dom.tag
   * @property {string|null} dom.id
   * @property {string} dom.className
   * @property {string} dom.text
   * @property {Object<string, string>} dom.attributes
   * @property {Object} path
   * @property {Array<{tag: string, index: number, className?: string}>} path.segments
   * @property {string} path.description
   * @property {Object} geometry
   * @property {number} geometry.x
   * @property {number} geometry.y
   * @property {number} geometry.width
   * @property {number} geometry.height
   * @property {Object} neighbors
   * @property {string} neighbors.precedingText
   * @property {string} neighbors.followingText
   * @property {Array<{tag: string, text: string, isTarget: boolean}>} neighbors.siblings
   * @property {Object} [markers]
   * @property {string} [markers.aiId]
   * @property {string} [markers.component]
   * @property {string} [markers.testId]
   * @property {Object} [react]
   * @property {string} [react.componentName]
   * @property {any} [react.props]
   * @property {boolean} react.fiberAvailable
   */

  /**
   * @typedef {Object} LocationClues
   * @property {Object} highConfidence
   * @property {string} [highConfidence.aiId]
   * @property {string} [highConfidence.testId]
   * @property {string} [highConfidence.componentName]
   * @property {Object} mediumConfidence
   * @property {string[]} mediumConfidence.possibleFileNames
   * @property {string[]} mediumConfidence.classNamePatterns
   * @property {string[]} mediumConfidence.textKeywords
   * @property {Object} context
   * @property {string} context.pageContext
   * @property {string} context.elementRole
   * @property {string} context.surroundingText
   * @property {Object} searchStrategy
   * @property {Array<{type: string, query: string, reason: string}>} searchStrategy.steps
   */

  /**
   * @typedef {Object} SelectionPayload
   * @property {string} version
   * @property {string} timestamp
   * @property {Object} selection
   * @property {string} selection.markerId
   * @property {string} selection.markerLabel
   * @property {ElementContext} context
   * @property {LocationClues} clues
   * @property {string} instruction
   */

  // ============================================
  // Level 1: 核心模块（100% 稳定）
  // ============================================

  class ElementScanner {
    constructor() {
      this.selector = `
        button:not([disabled]), 
        input:not([type="hidden"]):not([disabled]), 
        select:not([disabled]), 
        textarea:not([disabled]),
        a[href], 
        [role="button"], 
        [role="link"], 
        [role="input"],
        [data-ai-id], 
        [data-component],
        [data-testid],
        [data-cy],
        .clickable
      `
        .replace(/\s+/g, " ")
        .trim();
    }

    /**
     * 扫描页面上的可见交互元素
     * @returns {Marker[]}
     */
    scan() {
      try {
        const elements = Array.from(document.querySelectorAll(this.selector));

        return elements
          .filter((el) => this.isVisible(el))
          .map((el, index) => ({
            id: `marker-${index}`,
            label: (index + 1).toString(),
            element: el,
            rect: el.getBoundingClientRect(),
          }));
      } catch (e) {
        console.warn("[UI Marker] 扫描失败:", e.message);
        return [];
      }
    }

    /**
     * 判断元素是否可见
     * @param {HTMLElement} el
     * @returns {boolean}
     */
    isVisible(el) {
      try {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        // 检查尺寸和显示属性
        const hasSize = rect.width > 0 && rect.height > 0;
        const isDisplayed = style.display !== "none" && style.visibility !== "hidden";
        const hasOpacity = style.opacity !== "0";
        const isInViewport =
          rect.top < window.innerHeight &&
          rect.bottom > 0 &&
          rect.left < window.innerWidth &&
          rect.right > 0;

        return hasSize && isDisplayed && hasOpacity && isInViewport;
      } catch {
        return false;
      }
    }
  }

  class ContextCollector {
    /**
     * 收集元素的多维上下文信息
     * @param {Marker} marker
     * @returns {ElementContext}
     */
    collect(marker) {
      const el = marker.element;

      return {
        dom: this.collectDOM(el),
        path: this.collectPath(el),
        geometry: this.collectGeometry(marker),
        neighbors: this.collectNeighbors(el),
        markers: this.collectMarkers(el),
        react: this.tryCollectReact(el), // Level 3, opportunistic
      };
    }

    /**
     * 收集 DOM 基础信息
     * @param {HTMLElement} el
     * @returns {ElementContext['dom']}
     */
    collectDOM(el) {
      const attrs = {};
      for (const attr of el.attributes) {
        if (attr.name.startsWith("data-")) {
          attrs[attr.name] = attr.value;
        }
      }

      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        className: el.className || "",
        text: (el.textContent || "").trim().slice(0, 100),
        attributes: attrs,
      };
    }

    /**
     * 收集元素路径
     * @param {HTMLElement} el
     * @returns {ElementContext['path']}
     */
    collectPath(el) {
      const segments = [];
      let current = el;
      let depth = 0;

      while (current && current !== document.body && depth < 10) {
        const parent = current.parentElement;
        if (!parent) break;

        const siblings = Array.from(parent.children).filter((c) => c.tagName === current.tagName);
        const index = siblings.indexOf(current);

        segments.unshift({
          tag: current.tagName.toLowerCase(),
          index,
          className: current.className || undefined,
        });

        current = parent;
        depth++;
      }

      // 添加 body
      segments.unshift({ tag: "body", index: 0 });

      // 生成描述
      const description = segments
        .map((s) => {
          if (s.className) {
            const firstClass = s.className.split(" ")[0];
            return `${s.tag}.${firstClass}`;
          }
          return s.tag;
        })
        .join(" > ");

      return { segments, description };
    }

    /**
     * 收集几何信息
     * @param {Marker} marker
     * @returns {ElementContext['geometry']}
     */
    collectGeometry(marker) {
      return {
        x: marker.rect.x,
        y: marker.rect.y,
        width: marker.rect.width,
        height: marker.rect.height,
      };
    }

    /**
     * 收集邻居信息
     * @param {HTMLElement} el
     * @returns {ElementContext['neighbors']}
     */
    collectNeighbors(el) {
      const parent = el.parentElement;
      const siblings = parent
        ? Array.from(parent.children).map((c) => ({
            tag: c.tagName.toLowerCase(),
            text: (c.textContent || "").trim().slice(0, 50),
            isTarget: c === el,
          }))
        : [];

      return {
        precedingText: this.getAdjacentText(el, "previous"),
        followingText: this.getAdjacentText(el, "next"),
        siblings,
      };
    }

    /**
     * 获取相邻元素的文本
     * @param {HTMLElement} el
     * @param {'previous' | 'next'} direction
     * @returns {string}
     */
    getAdjacentText(el, direction) {
      let sibling = direction === "previous" ? el.previousElementSibling : el.nextElementSibling;

      let text = "";
      for (let i = 0; i < 3 && sibling; i++) {
        text += (sibling.textContent || "").trim() + " ";
        sibling =
          direction === "previous" ? sibling.previousElementSibling : sibling.nextElementSibling;
      }
      return text.trim().slice(0, 100);
    }

    /**
     * 收集标记信息（Level 2）
     * @param {HTMLElement} el
     * @returns {ElementContext['markers']}
     */
    collectMarkers(el) {
      const markers = {};
      const dataset = el.dataset;

      if (dataset.aiId) markers.aiId = dataset.aiId;
      if (dataset.component) markers.component = dataset.component;
      if (dataset.testid) markers.testId = dataset.testid;
      if (dataset.cy) markers.testId = dataset.cy;

      return Object.keys(markers).length > 0 ? markers : undefined;
    }

    /**
     * 尝试收集 React 信息（Level 3，opportunistic）
     * @param {HTMLElement} el
     * @returns {ElementContext['react']}
     */
    tryCollectReact(el) {
      const result = { fiberAvailable: false };

      try {
        // 尝试找 Fiber 属性
        const fiberKey = Object.keys(el).find(
          (k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternal")
        );

        if (!fiberKey) return result;

        const fiber = el[fiberKey];
        if (!fiber) return result;

        result.fiberAvailable = true;

        // 向上找组件名
        let current = fiber;
        while (current) {
          if (current.type && (current.type.displayName || current.type.name)) {
            result.componentName = current.type.displayName || current.type.name;
            break;
          }
          current = current.return;
        }

        // 尝试获取 Props（限制大小）
        if (fiber.memoizedProps) {
          result.props = this.sanitizeProps(fiber.memoizedProps);
        }
      } catch (e) {
        // 静默失败
      }

      return result;
    }

    /**
     * 清理 Props，避免泄露过大对象
     * @param {any} props
     * @returns {any}
     */
    sanitizeProps(props) {
      const result = {};
      const keys = Object.keys(props).slice(0, 10); // 限制数量

      for (const key of keys) {
        const val = props[key];
        if (typeof val === "function") {
          result[key] = "[Function]";
        } else if (typeof val === "object" && val !== null) {
          result[key] = "[Object]";
        } else {
          result[key] = val;
        }
      }

      return result;
    }
  }

  class ClueGenerator {
    /**
     * 生成 AI 友好的定位线索
     * @param {ElementContext} context
     * @returns {LocationClues}
     */
    generate(context) {
      return {
        highConfidence: this.getHighConfidence(context),
        mediumConfidence: this.getMediumConfidence(context),
        context: this.getContext(context),
        searchStrategy: this.getSearchStrategy(context),
      };
    }

    /**
     * 获取高置信度线索
     * @param {ElementContext} context
     * @returns {Object}
     */
    getHighConfidence(context) {
      const clues = {};
      if (context.markers?.aiId) clues.aiId = context.markers.aiId;
      if (context.markers?.testId) clues.testId = context.markers.testId;
      if (context.react?.componentName) clues.componentName = context.react.componentName;
      return clues;
    }

    /**
     * 获取中置信度线索
     * @param {ElementContext} context
     * @returns {Object}
     */
    getMediumConfidence(context) {
      const text = context.dom.text;
      const className = context.dom.className;

      return {
        possibleFileNames: this.inferFileNames(text, className, context.dom.tag),
        classNamePatterns: className.split(" ").filter((c) => c.trim().length > 0),
        textKeywords: this.extractKeywords(text),
      };
    }

    /**
     * 推断可能的文件名
     * @param {string} text
     * @param {string} className
     * @param {string} tag
     * @returns {string[]}
     */
    inferFileNames(text, className, tag) {
      const names = [];

      // 从文本推断
      if (text.includes("订单") || text.includes("Order")) {
        names.push("Order.tsx", "OrderForm.tsx", "OrderSubmit.tsx");
      }
      if (text.includes("用户") || text.includes("User")) {
        names.push("User.tsx", "UserProfile.tsx", "UserInfo.tsx");
      }
      if (text.includes("提交") || text.includes("Submit")) {
        names.push("SubmitButton.tsx", "SubmitForm.tsx");
      }
      if (text.includes("登录") || text.includes("Login")) {
        names.push("Login.tsx", "LoginForm.tsx", "LoginButton.tsx");
      }

      // 从类名推断
      const classParts = className.split("-");
      if (classParts.length > 1) {
        const capitalized = classParts
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join("");
        names.push(`${capitalized}.tsx`);
      }

      // 从标签推断
      if (tag === "button") names.push("Button.tsx", "BaseButton.tsx");
      if (tag === "input") names.push("Input.tsx", "TextField.tsx");

      // 去重
      return [...new Set(names)];
    }

    /**
     * 提取文本关键词
     * @param {string} text
     * @returns {string[]}
     */
    extractKeywords(text) {
      // 简单的关键词提取：去除短词、常见词
      const words = text
        .split(/[\s\.,!?;:]+/)
        .filter(
          (word) =>
            word.length > 2 &&
            !["the", "and", "for", "with", "this", "that", "but"].includes(word.toLowerCase())
        );

      return words.slice(0, 5);
    }

    /**
     * 获取上下文描述
     * @param {ElementContext} context
     * @returns {Object}
     */
    getContext(context) {
      const tag = context.dom.tag;
      const text = context.dom.text;

      return {
        pageContext: this.inferPageContext(context),
        elementRole: this.inferElementRole(tag, text),
        surroundingText: `${context.neighbors.precedingText.slice(0, 50)} [${text}] ${context.neighbors.followingText.slice(0, 50)}`,
      };
    }

    /**
     * 推断页面上下文
     * @param {ElementContext} context
     * @returns {string}
     */
    inferPageContext(context) {
      const path = context.path.description;
      const siblings = context.neighbors.siblings;

      if (path.includes("form") || siblings.some((s) => s.tag === "form")) {
        return "这是一个表单页面，包含多个输入字段";
      }
      if (path.includes("nav") || path.includes("header")) {
        return "这是一个导航或头部区域";
      }
      if (context.dom.tag === "button" && context.dom.text.includes("提交")) {
        return "这是一个提交页面，包含确认操作的按钮";
      }

      return `页面包含 ${context.dom.tag} 元素`;
    }

    /**
     * 推断元素角色
     * @param {string} tag
     * @param {string} text
     * @returns {string}
     */
    inferElementRole(tag, text) {
      const roles = {
        button: "按钮",
        input: "输入框",
        textarea: "文本域",
        select: "下拉选择框",
        a: "链接",
      };

      const role = roles[tag] || "交互元素";
      return `这是一个${role}，内容为"${text.slice(0, 30)}"`;
    }

    /**
     * 获取搜索策略
     * @param {ElementContext} context
     * @returns {Object}
     */
    getSearchStrategy(context) {
      const steps = [];

      // 高置信度搜索
      if (context.markers?.aiId) {
        steps.push({
          type: "exact",
          query: `data-ai-id="${context.markers.aiId}"`,
          reason: "开发者显式标记，最可靠",
        });
      }

      if (context.react?.componentName) {
        steps.push({
          type: "exact",
          query: `component ${context.react.componentName}`,
          reason: "React 组件名直接对应文件",
        });
      }

      if (context.markers?.testId) {
        steps.push({
          type: "exact",
          query: `data-testid="${context.markers.testId}"`,
          reason: "测试标记，通常对应关键元素",
        });
      }

      // 中置信度搜索
      if (context.dom.text) {
        steps.push({
          type: "fuzzy",
          query: `${context.dom.text} ${context.dom.tag}`,
          reason: "文本 + 标签搜索",
        });
      }

      if (context.dom.className) {
        const classes = context.dom.className.split(" ").filter(Boolean);
        if (classes.length > 0) {
          steps.push({
            type: "content",
            query: classes.join(" "),
            reason: "通过 CSS 类名搜索",
          });
        }
      }

      // 降级搜索
      if (steps.length === 0) {
        steps.push({
          type: "fuzzy",
          query: context.dom.tag,
          reason: "基础标签搜索",
        });
      }

      return { steps };
    }
  }

  // ============================================
  // UI 渲染器
  // ============================================

  class UIRenderer {
    constructor() {
      this.labels = [];
      this.overlay = null;
      this.tooltip = null;
      this.dialog = null;

      this.createOverlay();
      this.createTooltip();
    }

    /**
     * 创建高亮覆盖层
     */
    createOverlay() {
      this.overlay = document.createElement("div");
      Object.assign(this.overlay.style, {
        position: "fixed",
        border: "2px solid #6366f1",
        background: "rgba(99, 102, 241, 0.1)",
        borderRadius: "4px",
        pointerEvents: "none",
        zIndex: "2147483646",
        display: "none",
        boxSizing: "border-box",
      });
    }

    /**
     * 创建信息提示框
     */
    createTooltip() {
      this.tooltip = document.createElement("div");
      Object.assign(this.tooltip.style, {
        position: "fixed",
        background: "#1f2937",
        color: "white",
        padding: "8px 12px",
        borderRadius: "6px",
        fontSize: "12px",
        zIndex: "2147483647",
        pointerEvents: "none",
        display: "none",
        maxWidth: "200px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        whiteSpace: "pre-line",
        lineHeight: "1.4",
      });
    }

    /**
     * 渲染标记标签
     * @param {Marker[]} markers
     */
    renderLabels(markers) {
      this.clearLabels();

      markers.forEach((marker) => {
        const label = document.createElement("div");
        Object.assign(label.style, {
          position: "fixed",
          top: `${marker.rect.top + window.scrollY - 10}px`,
          left: `${marker.rect.left + window.scrollX}px`,
          background: "#6366f1",
          color: "white",
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          fontSize: "11px",
          fontWeight: "bold",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: "2147483645",
          pointerEvents: "none",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
          cursor: "pointer",
          userSelect: "none",
        });

        label.textContent = marker.label;
        label.className = "ui-marker-label";
        label.dataset.markerId = marker.id;

        document.body.appendChild(label);
        this.labels.push(label);
      });

      // 添加覆盖层和提示框
      if (!this.overlay.parentElement) {
        document.body.appendChild(this.overlay);
      }
      if (!this.tooltip.parentElement) {
        document.body.appendChild(this.tooltip);
      }
    }

    /**
     * 显示悬停效果
     * @param {Marker} marker
     * @param {ElementContext} context
     */
    showHover(marker, context) {
      const { rect } = marker;

      // 更新覆盖层位置
      Object.assign(this.overlay.style, {
        display: "block",
        top: `${rect.top + window.scrollY}px`,
        left: `${rect.left + window.scrollX}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });

      // 构建提示信息
      const infoLines = [
        `[${marker.label}] ${context.dom.tag}`,
        context.dom.text && `文本: ${context.dom.text.slice(0, 30)}`,
        context.markers?.aiId && `ID: ${context.markers.aiId}`,
        context.markers?.component && `组件: ${context.markers.component}`,
        context.react?.componentName && `React: ${context.react.componentName}`,
      ].filter(Boolean);

      // 计算提示框位置（优先显示在上方）
      let tooltipTop = rect.top + window.scrollY - 50;
      let tooltipLeft = rect.left + window.scrollX;

      // 如果上方空间不足，显示在下方
      if (tooltipTop < 10) {
        tooltipTop = rect.bottom + window.scrollY + 10;
      }

      // 如果右侧超出屏幕，左移
      if (tooltipLeft + 200 > window.innerWidth) {
        tooltipLeft = window.innerWidth - 220;
      }

      Object.assign(this.tooltip.style, {
        display: "block",
        top: `${tooltipTop}px`,
        left: `${tooltipLeft}px`,
      });

      this.tooltip.textContent = infoLines.join("\n");
    }

    /**
     * 隐藏悬停效果
     */
    hideHover() {
      this.overlay.style.display = "none";
      this.tooltip.style.display = "none";
    }

    /**
     * 显示输入对话框
     * @param {Marker} marker
     * @param {ElementContext} context
     * @returns {Promise<string|null>} 用户输入或 null
     */
    async showDialog(marker, context) {
      return new Promise((resolve) => {
        // 如果已有对话框，先移除
        if (this.dialog) {
          this.dialog.remove();
        }

        // 创建对话框
        this.dialog = document.createElement("div");
        Object.assign(this.dialog.style, {
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "white",
          borderRadius: "8px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          zIndex: "2147483647",
          minWidth: "400px",
          maxWidth: "500px",
          overflow: "hidden",
        });

        // 对话框内容
        const title = document.createElement("div");
        title.style.cssText = `
          padding: 16px 20px;
          background: #4f46e5;
          color: white;
          font-weight: 600;
          font-size: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        `;
        title.innerHTML = `
          <span>元素 [${marker.label}] ${context.dom.tag}</span>
          <button id="ui-marker-close" style="
            background: none;
            border: none;
            color: white;
            font-size: 16px;
            cursor: pointer;
            padding: 0;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">×</button>
        `;

        const body = document.createElement("div");
        body.style.cssText = `
          padding: 20px;
        `;

        const label = document.createElement("label");
        label.style.cssText = `
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
          color: #4b5563;
          font-weight: 500;
        `;
        label.textContent = "描述你的修改需求：";

        const textarea = document.createElement("textarea");
        textarea.style.cssText = `
          width: 100%;
          min-height: 80px;
          padding: 10px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          resize: vertical;
          box-sizing: border-box;
          margin-bottom: 16px;
        `;
        textarea.placeholder = '例如：改成红色，文字改为"立即购买"';

        const buttonGroup = document.createElement("div");
        buttonGroup.style.cssText = `
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        `;

        const cancelBtn = document.createElement("button");
        cancelBtn.style.cssText = `
          padding: 8px 16px;
          background: #f3f4f6;
          color: #4b5563;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
        `;
        cancelBtn.textContent = "取消";

        const submitBtn = document.createElement("button");
        submitBtn.style.cssText = `
          padding: 8px 16px;
          background: #4f46e5;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
        `;
        submitBtn.textContent = "发送给 AI";

        // 组装
        body.appendChild(label);
        body.appendChild(textarea);
        buttonGroup.appendChild(cancelBtn);
        buttonGroup.appendChild(submitBtn);
        body.appendChild(buttonGroup);

        this.dialog.appendChild(title);
        this.dialog.appendChild(body);
        document.body.appendChild(this.dialog);

        // 焦点自动到输入框
        textarea.focus();

        // 事件处理
        const close = () => {
          this.dialog.remove();
          this.dialog = null;
          resolve(null);
        };

        title.querySelector("#ui-marker-close").addEventListener("click", close);
        cancelBtn.addEventListener("click", close);

        const submit = () => {
          const instruction = textarea.value.trim();
          if (instruction) {
            this.dialog.remove();
            this.dialog = null;
            resolve(instruction);
          } else {
            textarea.focus();
          }
        };

        submitBtn.addEventListener("click", submit);
        textarea.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            submit();
          }
          if (e.key === "Escape") {
            close();
          }
        });

        // 点击外部关闭
        const overlay = document.createElement("div");
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 2147483646;
        `;
        document.body.appendChild(overlay);
        overlay.addEventListener("click", close);

        // 清理函数
        const cleanup = () => {
          overlay.remove();
          if (this.dialog) {
            this.dialog.remove();
            this.dialog = null;
          }
        };

        // 确保清理
        this.dialog._cleanup = cleanup;
      });
    }

    /**
     * 清除所有标签
     */
    clearLabels() {
      this.labels.forEach((label) => label.remove());
      this.labels = [];
      this.hideHover();

      // 不移除 overlay 和 tooltip，它们会被重用
    }
  }

  // ============================================
  // 主控制器
  // ============================================

  class UIMarker {
    /**
     * @param {Object} options
     * @param {Function} [options.onSubmit] 提交回调函数
     * @param {string} [options.shortcut='Ctrl+Shift+M'] 快捷键
     */
    constructor(options = {}) {
      this.scanner = new ElementScanner();
      this.collector = new ContextCollector();
      this.clueGen = new ClueGenerator();
      this.renderer = new UIRenderer();

      this.markers = [];
      this.isActive = false;
      this.onSubmit = options.onSubmit;
      this.shortcut = options.shortcut || "Ctrl+Shift+M";
      this.controlButton = null; // 浮动控制按钮

      this.bindEvents();
    }

    /**
     * 绑定全局事件
     */
    bindEvents() {
      document.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === "M") {
          this.toggle();
        }
      });

      // 窗口大小变化时重新计算标记位置
      let resizeTimer;
      window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (this.isActive) {
            this.rescan();
          }
        }, 100);
      });
    }

    /**
     * 重新扫描并更新标记
     */
    rescan() {
      if (!this.isActive) return;

      this.markers = this.scanner.scan();
      this.renderer.renderLabels(this.markers);
    }

    /**
     * 创建浮动控制按钮（手机友好，可拖动）
     */
    createControlButton() {
      // 如果已存在，先移除
      if (this.controlButton) {
        this.controlButton.remove();
      }

      const button = document.createElement("div");
      button.className = "ui-marker-control-button";
      button.id = "ui-marker-control-btn";

      // 从 localStorage 读取保存的位置，或使用默认位置（右侧中部）
      let savedPos = null;
      try {
        const saved = localStorage.getItem("UI_MARKER_BUTTON_POS");
        if (saved) {
          savedPos = JSON.parse(saved);
        }
      } catch (e) {
        // 忽略错误
      }

      // 默认位置：右侧上下中部（垂直居中偏上一点）
      const defaultTop = window.innerHeight / 2 - 100;
      const defaultRight = 20;

      const top = savedPos?.top ?? defaultTop;
      const right = savedPos?.right ?? defaultRight;

      // 样式
      Object.assign(button.style, {
        position: "fixed",
        top: `${top}px`,
        right: `${right}px`,
        width: "50px",
        height: "50px",
        background: "#ef4444", // 红色，更醒目
        color: "white",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "24px",
        fontWeight: "bold",
        cursor: "move", // 表示可拖动
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        zIndex: "2147483644", // 比标记低一级
        userSelect: "none",
        touchAction: "none", // 防止触摸时的默认行为
        transition: "transform 0.2s ease, background 0.2s ease",
      });

      button.textContent = "×";
      button.title = "点击停用 UI Marker，按住拖动移动位置";

      // 拖动功能
      let isDragging = false;
      let startX, startY;
      let startTop, startRight;
      let dragThreshold = 5; // 移动超过这个像素数才算拖动
      let hasMoved = false;

      const onPointerDown = (e) => {
        isDragging = true;
        hasMoved = false;
        startX = e.clientX || e.touches?.[0]?.clientX;
        startY = e.clientY || e.touches?.[0]?.clientY;

        // 获取当前位置
        const rect = button.getBoundingClientRect();
        startTop = rect.top;
        startRight = window.innerWidth - rect.right;

        button.style.transition = "none"; // 拖动时禁用过渡动画
        button.style.transform = "scale(0.95)"; // 按下效果

        // 阻止默认行为（防止页面滚动）
        e.preventDefault?.();
      };

      const onPointerMove = (e) => {
        if (!isDragging) return;

        const clientX = e.clientX || e.touches?.[0]?.clientX;
        const clientY = e.clientY || e.touches?.[0]?.clientY;

        if (!clientX || !clientY) return;

        const deltaX = clientX - startX;
        const deltaY = clientY - startY;

        // 检查是否移动了足够距离
        if (Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold) {
          hasMoved = true;
        }

        // 计算新位置（保持 right 定位）
        let newTop = startTop + deltaY;
        let newRight = startRight - deltaX;

        // 边界限制
        const maxTop = window.innerHeight - 60;
        const maxRight = window.innerWidth - 60;
        newTop = Math.max(10, Math.min(newTop, maxTop));
        newRight = Math.max(10, Math.min(newRight, maxRight));

        button.style.top = `${newTop}px`;
        button.style.right = `${newRight}px`;

        e.preventDefault?.();
      };

      const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;

        button.style.transition = "transform 0.2s ease, background 0.2s ease";
        button.style.transform = "scale(1)";

        if (hasMoved) {
          // 保存位置到 localStorage
          try {
            const rect = button.getBoundingClientRect();
            const pos = {
              top: rect.top,
              right: window.innerWidth - rect.right,
            };
            localStorage.setItem("UI_MARKER_BUTTON_POS", JSON.stringify(pos));
          } catch (e) {
            // 忽略错误
          }
        } else {
          // 如果没有移动（只是点击），则停用 UI Marker
          this.deactivate();
          try {
            localStorage.setItem("UI_MARKER_ENABLED", "false");
          } catch (e) {
            // 忽略错误
          }
        }
      };

      // 鼠标事件
      button.addEventListener("mousedown", onPointerDown);
      document.addEventListener("mousemove", onPointerMove);
      document.addEventListener("mouseup", onPointerUp);

      // 触摸事件（移动端）
      button.addEventListener("touchstart", onPointerDown, { passive: false });
      document.addEventListener("touchmove", onPointerMove, { passive: false });
      document.addEventListener("touchend", onPointerUp);

      // 悬停效果
      button.addEventListener("mouseenter", () => {
        if (!isDragging) {
          button.style.transform = "scale(1.1)";
          button.style.background = "#dc2626";
        }
      });
      button.addEventListener("mouseleave", () => {
        if (!isDragging) {
          button.style.transform = "scale(1)";
          button.style.background = "#ef4444";
        }
      });

      // 窗口大小变化时调整位置
      const onResize = () => {
        const rect = button.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
          button.style.right = "20px";
        }
        if (rect.bottom > window.innerHeight) {
          button.style.top = `${window.innerHeight - 60}px`;
        }
      };
      window.addEventListener("resize", onResize);

      // 保存引用以便清理
      button._cleanup = () => {
        window.removeEventListener("resize", onResize);
        document.removeEventListener("mousemove", onPointerMove);
        document.removeEventListener("mouseup", onPointerUp);
        document.removeEventListener("touchmove", onPointerMove);
        document.removeEventListener("touchend", onPointerUp);
      };

      document.body.appendChild(button);
      this.controlButton = button;

      return button;
    }

    /**
     * 移除浮动控制按钮
     */
    removeControlButton() {
      if (this.controlButton) {
        // 清理事件监听器
        if (this.controlButton._cleanup) {
          this.controlButton._cleanup();
        }
        this.controlButton.remove();
        this.controlButton = null;
      }
    }

    /**
     * 激活 UI Marker
     */
    activate() {
      if (this.isActive) return;

      this.isActive = true;
      this.markers = this.scanner.scan();

      if (this.markers.length === 0) {
        console.warn("[UI Marker] 未找到可交互元素");
        this.isActive = false;
        return;
      }

      this.renderer.renderLabels(this.markers);

      // 绑定交互事件
      this._boundMouseMove = this.handleMouseMove.bind(this);
      this._boundClick = this.handleClick.bind(this);

      document.addEventListener("mousemove", this._boundMouseMove);
      document.addEventListener("click", this._boundClick, true);

      // 创建浮动控制按钮（手机友好）
      this.createControlButton();

      console.log(`[UI Marker] 已激活，找到 ${this.markers.length} 个元素`);
    }

    /**
     * 停用 UI Marker
     */
    deactivate() {
      if (!this.isActive) return;

      this.isActive = false;
      this.renderer.clearLabels();

      if (this._boundMouseMove) {
        document.removeEventListener("mousemove", this._boundMouseMove);
      }
      if (this._boundClick) {
        document.removeEventListener("click", this._boundClick, true);
      }

      // 移除浮动控制按钮
      this.removeControlButton();

      console.log("[UI Marker] 已停用");
    }

    /**
     * 切换激活状态
     */
    toggle() {
      this.isActive ? this.deactivate() : this.activate();
    }

    /**
     * 处理鼠标移动
     * @param {MouseEvent} e
     */
    handleMouseMove(e) {
      if (!this.isActive) return;

      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target) {
        this.renderer.hideHover();
        return;
      }

      const marker = this.findMarker(target);
      if (marker) {
        const context = this.collector.collect(marker);
        this.renderer.showHover(marker, context);
      } else {
        this.renderer.hideHover();
      }
    }

    /**
     * 处理点击事件
     * @param {MouseEvent} e
     */
    handleClick(e) {
      if (!this.isActive) return;

      const target = e.target;
      const marker = this.findMarker(target);

      if (marker) {
        e.preventDefault();
        e.stopPropagation();
        this.handleSelect(marker);
      }
    }

    /**
     * 查找目标元素对应的标记
     * @param {Element} el
     * @returns {Marker|null}
     */
    findMarker(el) {
      return this.markers.find((m) => m.element === el || m.element.contains(el)) || null;
    }

    /**
     * 处理元素选择
     * @param {Marker} marker
     */
    async handleSelect(marker) {
      const context = this.collector.collect(marker);
      const clues = this.clueGen.generate(context);

      const instruction = await this.renderer.showDialog(marker, context);
      if (!instruction) return;

      const payload = {
        version: "2.0",
        timestamp: new Date().toISOString(),
        selection: {
          markerId: marker.id,
          markerLabel: marker.label,
        },
        context,
        clues,
        instruction,
      };

      // 触发回调
      if (this.onSubmit) {
        try {
          this.onSubmit(payload);
        } catch (e) {
          console.error("[UI Marker] onSubmit 回调错误:", e);
        }
      }

      // 触发自定义事件
      window.dispatchEvent(new CustomEvent("ui-marker:submit", { detail: payload }));

      // 输出到控制台（方便调试）
      console.log("[UI Marker] 提交的数据:", payload);
    }
  }

  // ============================================
  // 全局暴露和自动初始化
  // ============================================

  // 暴露 UIMarker 类到全局
  window.UIMarker = UIMarker;

  // 可选：自动创建实例并提供全局访问
  if (!window.uiMarker) {
    window.uiMarker = new UIMarker();

    // 检查 localStorage 设置，决定是否自动激活
    try {
      const value = localStorage.getItem("UI_MARKER_ENABLED");
      // 如果设置为 "true"，则自动激活
      if (value === "true" && window.uiMarker) {
        // 延迟激活以确保 DOM 已准备就绪
        setTimeout(() => {
          if (window.uiMarker && !window.uiMarker.isActive) {
            window.uiMarker.activate();
            console.log("[UI Marker] Auto-activated from localStorage");
          }
        }, 500);
      }
    } catch (e) {
      // 忽略 localStorage 错误
      console.warn("[UI Marker] Failed to read localStorage:", e);
    }

    // 开发环境提示
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      console.log(
        "%c[UI Marker v2.0]%c 已加载，按 Ctrl+Shift+M 激活\n%c在手机上可通过工具菜单 (右下角) 控制",
        "background: #6366f1; color: white; padding: 2px 6px; border-radius: 3px;",
        "",
        "color: #666; font-size: 12px;"
      );
    }
  }

  // 添加全局帮助函数
  if (!window.toggleUIMarker) {
    window.toggleUIMarker = function () {
      if (window.uiMarker) {
        window.uiMarker.toggle();
        return true;
      }
      return false;
    };
  }

  // 添加紧急停用函数（可在控制台调用）
  if (!window.forceDisableUIMarker) {
    window.forceDisableUIMarker = function () {
      try {
        if (window.uiMarker && window.uiMarker.isActive) {
          window.uiMarker.deactivate();
          localStorage.setItem("UI_MARKER_ENABLED", "false");
          console.log("[UI Marker] Force disabled");
          return true;
        }
      } catch (e) {
        console.error("[UI Marker] Force disable failed:", e);
      }
      return false;
    };
  }
})();
