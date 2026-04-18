/**
 * UI Marker - Enhanced Version
 * 功能完善的界面元素标记工具
 * 
 * 改进点：
 * 1. 使用 Map 优化元素查找性能
 * 2. 添加防抖处理，优化性能
 * 3. 自定义对话框替代 prompt
 * 4. 支持键盘导航（Tab/方向键）
 * 5. 监听滚动和窗口变化，自动更新位置
 * 6. 支持 MutationObserver 动态内容
 * 7. 更完善的错误边界处理
 * 8. 更丰富的配置选项
 * 9. 持久化用户设置
 */

(function() {
  'use strict';

  // ============================================
  // 默认配置
  // ============================================
  const DEFAULT_CONFIG = {
    // 快捷键
    shortcut: {
      activate: 'ctrl+shift+m',
      deactivate: 'escape',
      next: 'arrowdown',
      prev: 'arrowup',
      select: 'enter'
    },
    
    // 扫描配置
    selector: `
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
      [data-cy]
    `,
    
    // 视觉配置
    theme: {
      primary: '#6366f1',
      primaryLight: 'rgba(99, 102, 241, 0.1)',
      tooltipBg: '#1f2937',
      tooltipColor: '#ffffff',
      overlayBorder: '2px solid #6366f1',
      labelSize: '14px',
      labelFontSize: '9px',
      labelOpacity: '0.85',
      zIndex: {
        label: 2147483645,
        overlay: 2147483646,
        tooltip: 2147483647,
        dialog: 2147483647
      }
    },
    
    // 行为配置
    behavior: {
      maxPathDepth: 10,
      textTruncateLength: 100,
      enableAutoRefresh: true,
      refreshInterval: 500,
      debounceMs: 16 // ~60fps
    }
  };

  // ============================================
  // 工具函数
  // ============================================
  const utils = {
    // 防抖函数
    debounce(fn, ms) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), ms);
      };
    },
    
    // 节流函数
    throttle(fn, ms) {
      let last = 0;
      return (...args) => {
        const now = Date.now();
        if (now - last >= ms) {
          last = now;
          fn.apply(this, args);
        }
      };
    },
    
    // 生成唯一ID
    uuid() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },
    
    // 解析快捷键
    parseShortcut(shortcut) {
      const parts = shortcut.toLowerCase().split('+');
      return {
        ctrl: parts.includes('ctrl'),
        shift: parts.includes('shift'),
        alt: parts.includes('alt'),
        meta: parts.includes('meta'),
        key: parts.find(p => !['ctrl', 'shift', 'alt', 'meta'].includes(p)) || ''
      };
    },
    
    // 检查快捷键匹配
    matchShortcut(event, shortcut) {
      const parsed = typeof shortcut === 'string' ? this.parseShortcut(shortcut) : shortcut;
      return event.ctrlKey === parsed.ctrl &&
             event.shiftKey === parsed.shift &&
             event.altKey === parsed.alt &&
             event.metaKey === parsed.meta &&
             event.key.toLowerCase() === parsed.key;
    },
    
    // 截断文本
    truncate(str, length) {
      if (!str || str.length <= length) return str || '';
      return str.slice(0, length) + '...';
    },
    
    // 检查元素是否在视口内
    isInViewport(rect) {
      return rect.top < window.innerHeight &&
             rect.bottom > 0 &&
             rect.left < window.innerWidth &&
             rect.right > 0;
    },
    
    // 深度克隆（简单版）
    clone(obj) {
      return JSON.parse(JSON.stringify(obj));
    },
    
    // 合并配置
    mergeConfig(defaults, user) {
      const result = this.clone(defaults);
      for (const key in user) {
        if (typeof user[key] === 'object' && !Array.isArray(user[key])) {
          result[key] = this.mergeConfig(result[key] || {}, user[key]);
        } else {
          result[key] = user[key];
        }
      }
      return result;
    }
  };

  // ============================================
  // ElementScanner - 元素扫描器
  // ============================================
  class ElementScanner {
    constructor(config) {
      this.config = config;
      this.observer = null;
    }
    
    // 扫描元素
    scan(root = document.body) {
      const elements = Array.from(root.querySelectorAll(this.config.selector));
      const markers = [];
      
      elements.forEach((el, index) => {
        if (this.isVisible(el) && this.isValidSize(el)) {
          markers.push(this.createMarker(el, index));
        }
      });
      
      return markers;
    }
    
    // 创建标记
    createMarker(element, index) {
      const rect = element.getBoundingClientRect();
      return {
        id: `marker-${index}-${utils.uuid().slice(0, 8)}`,
        label: (index + 1).toString(),
        element,
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom
        },
        index,
        timestamp: Date.now()
      };
    }
    
    // 检查元素可见性
    isVisible(el) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      
      const style = window.getComputedStyle(el);
      return style.display !== 'none' &&
             style.visibility !== 'hidden' &&
             style.opacity !== '0';
    }
    
    // 检查元素有效大小
    isValidSize(el) {
      const rect = el.getBoundingClientRect();
      return rect.width >= 5 && rect.height >= 5;
    }
    
    // 启动动态监听
    startDynamicWatching(onChange) {
      if (!this.config.behavior.enableAutoRefresh) return;
      
      this.observer = new MutationObserver(
        utils.debounce(() => {
          onChange?.();
        }, this.config.behavior.refreshInterval)
      );
      
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden']
      });
    }
    
    // 停止监听
    stopWatching() {
      this.observer?.disconnect();
      this.observer = null;
    }
  }

  // ============================================
  // ContextCollector - 上下文收集器
  // ============================================
  class ContextCollector {
    constructor(config) {
      this.config = config;
    }
    
    // 收集完整上下文
    collect(marker) {
      const el = marker.element;
      
      return {
        dom: this.collectDOM(el),
        path: this.collectPath(el),
        geometry: this.collectGeometry(marker),
        neighbors: this.collectNeighbors(el),
        attributes: this.collectAttributes(el),
        markers: this.collectMarkers(el),
        react: this.tryCollectReact(el),
        meta: {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          timestamp: Date.now(),
          url: window.location.href
        }
      };
    }
    
    // 收集 DOM 信息
    collectDOM(el) {
      const text = this.getElementText(el);
      
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        className: el.className || '',
        classList: Array.from(el.classList || []),
        text: utils.truncate(text, this.config.behavior.textTruncateLength),
        html: utils.truncate(el.innerHTML, 500),
        
        // 表单元素特有属性
        type: el.type || null,
        name: el.name || null,
        value: el.value || null,
        placeholder: el.placeholder || null,
        
        // 链接特有
        href: el.href || null,
        target: el.target || null,
        
        // 状态
        disabled: el.disabled || false,
        readonly: el.readOnly || false,
        checked: el.checked || false,
        
        // 尺寸（相对于视口）
        rect: el.getBoundingClientRect().toJSON?.() || {}
      };
    }
    
    // 获取元素文本（包括 aria-label）
    getElementText(el) {
      // 优先使用 aria-label
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel;
      
      // 其次使用可见文本
      const text = el.textContent || '';
      
      // 如果是输入框，使用 placeholder 或 value
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        return el.placeholder || el.value || text;
      }
      
      return text.trim();
    }
    
    // 收集路径
    collectPath(el) {
      const segments = [];
      let current = el;
      let depth = 0;
      const maxDepth = this.config.behavior.maxPathDepth;
      
      while (current && current !== document.body && depth < maxDepth) {
        const parent = current.parentElement;
        if (!parent) break;
        
        // 计算同类型元素的索引
        const siblings = Array.from(parent.children).filter(
          c => c.tagName === current.tagName
        );
        const index = siblings.indexOf(current);
        
        // 获取标识信息
        const id = current.id ? `#${current.id}` : '';
        const classes = Array.from(current.classList || [])
          .filter(c => !c.startsWith('ui-marker'))
          .map(c => `.${c}`)
          .join('');
        
        segments.unshift({
          tag: current.tagName.toLowerCase(),
          index,
          id: current.id || null,
          className: current.className || null,
          selector: `${current.tagName.toLowerCase()}${id}${classes}`
        });
        
        current = parent;
        depth++;
      }
      
      // 添加 html 和 body
      if (document.documentElement) {
        segments.unshift({ tag: 'html', index: 0, selector: 'html' });
      }
      
      return {
        segments,
        depth: segments.length,
        description: segments.map(s => s.selector).join(' > '),
        // CSS 选择器路径
        cssPath: segments.map(s => s.selector).join(' > ')
      };
    }
    
    // 收集几何信息
    collectGeometry(marker) {
      const rect = marker.rect;
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };
      
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        viewport,
        // 相对位置
        relativeX: rect.left / viewport.width,
        relativeY: rect.top / viewport.height,
        // 是否在视口内
        inViewport: utils.isInViewport(rect)
      };
    }
    
    // 收集邻近元素信息
    collectNeighbors(el) {
      const parent = el.parentElement;
      
      // 获取所有兄弟
      const siblings = parent 
        ? Array.from(parent.children).map((c, i) => ({
            index: i,
            tag: c.tagName.toLowerCase(),
            id: c.id || null,
            className: c.className || null,
            text: utils.truncate(c.textContent || '', 50),
            isTarget: c === el
          }))
        : [];
      
      const targetIndex = siblings.findIndex(s => s.isTarget);
      
      return {
        // 前后文本内容
        precedingText: this.getAdjacentText(el, 'previous'),
        followingText: this.getAdjacentText(el, 'next'),
        
        // 兄弟元素
        siblings,
        siblingCount: siblings.length,
        targetIndex,
        
        // 邻近的兄弟（前后各2个）
        nearby: siblings.slice(
          Math.max(0, targetIndex - 2),
          Math.min(siblings.length, targetIndex + 3)
        ),
        
        // 父元素信息
        parent: parent ? {
          tag: parent.tagName.toLowerCase(),
          id: parent.id || null,
          className: parent.className || null
        } : null
      };
    }
    
    // 获取邻近文本
    getAdjacentText(el, direction) {
      const prop = direction === 'previous' ? 'previousElementSibling' : 'nextElementSibling';
      let sibling = el[prop];
      let text = '';
      
      // 查找最多3个兄弟的文本
      let count = 0;
      while (sibling && count < 3) {
        const siblingText = this.getElementText(sibling);
        if (siblingText) {
          text += (text ? ' ' : '') + siblingText;
        }
        sibling = sibling[prop];
        count++;
      }
      
      return utils.truncate(text, 200);
    }
    
    // 收集所有属性
    collectAttributes(el) {
      const attrs = {};
      
      for (const attr of el.attributes) {
        // 收集所有 data-* 和 aria-* 属性
        if (attr.name.startsWith('data-') || attr.name.startsWith('aria-')) {
          attrs[attr.name] = attr.value;
        }
      }
      
      return attrs;
    }
    
    // 收集标记
    collectMarkers(el) {
      return {
        aiId: el.dataset?.aiId || null,
        component: el.dataset?.component || null,
        testId: el.dataset?.testid || el.dataset?.cy || null,
        // 其他常见的测试标记
        qaId: el.dataset?.qa || el.dataset?.qaId || null,
        testAttr: el.dataset?.test || null
      };
    }
    
    // 尝试收集 React 信息
    tryCollectReact(el) {
      const result = {
        fiberAvailable: false,
        componentName: null,
        componentTree: [],
        props: null,
        hooks: null
      };
      
      try {
        // 查找 Fiber 属性
        const keys = Object.keys(el);
        const fiberKey = keys.find(k => 
          k.startsWith('__reactFiber') || 
          k.startsWith('__reactInternal')
        );
        
        if (!fiberKey) {
          // 尝试在父元素中查找
          let parent = el.parentElement;
          for (let i = 0; i < 3 && parent; i++) {
            const parentKeys = Object.keys(parent);
            const parentFiberKey = parentKeys.find(k => 
              k.startsWith('__reactFiber') || 
              k.startsWith('__reactInternal')
            );
            if (parentFiberKey) {
              el = parent;
              result.componentTree.push({ level: i + 1, note: 'found in parent' });
              break;
            }
            parent = parent.parentElement;
          }
          
          if (!fiberKey) return result;
        }
        
        const fiber = el[fiberKey];
        if (!fiber) return result;
        
        result.fiberAvailable = true;
        
        // 收集组件树
        let current = fiber;
        let depth = 0;
        const maxDepth = 5;
        
        while (current && depth < maxDepth) {
          let info = { depth };
          
          if (current.type) {
            // 函数或类组件
            if (typeof current.type === 'function') {
              info.name = current.type.displayName || 
                         current.type.name || 
                         'Anonymous';
              info.type = current.type.prototype?.isReactComponent ? 'class' : 'function';
            } 
            // 内置组件
            else if (typeof current.type === 'string') {
              info.name = current.type;
              info.type = 'host';
            }
            // forwardRef, memo 等
            else if (current.type.$$typeof) {
              info.name = current.type.displayName || 'Wrapped';
              info.type = 'wrapped';
            }
            
            if (info.name) {
              result.componentTree.push(info);
              
              // 记录最外层的组件名
              if (depth === 0 && info.type !== 'host') {
                result.componentName = info.name;
              }
            }
          }
          
          current = current.return;
          depth++;
        }
        
        // 收集 Props
        if (fiber.memoizedProps) {
          result.props = this.sanitizeProps(fiber.memoizedProps);
        }
        
        // 尝试获取 state
        if (fiber.memoizedState) {
          result.hooks = this.sanitizeHooks(fiber.memoizedState);
        }
        
      } catch (err) {
        // 静默失败
        result.error = err.message;
      }
      
      return result;
    }
    
    // 清理 Props
    sanitizeProps(props) {
      const result = {};
      const keys = Object.keys(props).slice(0, 20); // 限制数量
      
      for (const key of keys) {
        if (key === 'children') continue;
        
        const val = props[key];
        const type = typeof val;
        
        if (type === 'function') {
          result[key] = `[Function: ${val.name || 'anonymous'}]`;
        } else if (type === 'object' && val !== null) {
          if (val.$$typeof) {
            result[key] = '[ReactElement]';
          } else if (Array.isArray(val)) {
            result[key] = `[Array(${val.length})]`;
          } else {
            result[key] = '[Object]';
          }
        } else if (type === 'string' && val.length > 100) {
          result[key] = utils.truncate(val, 100);
        } else {
          result[key] = val;
        }
      }
      
      return result;
    }
    
    // 清理 Hooks
    sanitizeHooks(state) {
      const hooks = [];
      let current = state;
      let index = 0;
      const maxHooks = 10;
      
      while (current && index < maxHooks) {
        const hook = {
          index,
          type: this.inferHookType(current),
          value: this.sanitizeHookValue(current.memoizedState)
        };
        
        if (current.queue?.lastRenderedReducer) {
          hook.hasReducer = true;
        }
        
        hooks.push(hook);
        current = current.next;
        index++;
      }
      
      return hooks;
    }
    
    inferHookType(state) {
      if (!state) return 'unknown';
      if (state.create && state.deps) return 'useEffect';
      if (state.tag !== undefined) return 'useReducer';
      if (typeof state.memoizedState === 'function') return 'useCallback';
      return 'useState';
    }
    
    sanitizeHookValue(value) {
      if (value === null || value === undefined) return value;
      if (typeof value === 'function') return `[Function]`;
      if (typeof value === 'object') {
        if (Array.isArray(value)) return `[Array(${value.length})]`;
        return '[Object]';
      }
      if (typeof value === 'string' && value.length > 50) {
        return utils.truncate(value, 50);
      }
      return value;
    }
  }

  // ============================================
  // ClueGenerator - 线索生成器
  // ============================================
  class ClueGenerator {
    constructor(config) {
      this.config = config;
    }
    
    generate(context) {
      return {
        highConfidence: this.getHighConfidence(context),
        mediumConfidence: this.getMediumConfidence(context),
        lowConfidence: this.getLowConfidence(context),
        context: this.getContextDescription(context),
        searchStrategy: this.getSearchStrategy(context),
        suggestions: this.getSuggestions(context)
      };
    }
    
    getHighConfidence(context) {
      const clues = {};
      
      // data-ai-id 是最可靠的
      if (context.markers?.aiId) {
        clues.aiId = context.markers.aiId;
        clues.reliability = 'very-high';
      }
      
      // 其次是 data-testid
      if (context.markers?.testId) {
        clues.testId = context.markers.testId;
        clues.reliability = clues.reliability || 'high';
      }
      
      // React 组件名
      if (context.react?.componentName) {
        clues.componentName = context.react.componentName;
        clues.componentTree = context.react.componentTree;
        clues.reliability = clues.reliability || 'medium-high';
      }
      
      // 元素的 ID
      if (context.dom.id) {
        clues.elementId = context.dom.id;
      }
      
      return clues;
    }
    
    getMediumConfidence(context) {
      const text = context.dom.text;
      const className = context.dom.className;
      
      return {
        possibleFileNames: this.inferFileNames(context),
        classNamePatterns: this.extractClassPatterns(className),
        textKeywords: this.extractKeywords(text),
        pathKeywords: this.extractPathKeywords(context.path),
        semanticHints: this.getSemanticHints(context.dom)
      };
    }
    
    inferFileNames(context) {
      const names = new Set();
      const text = context.dom.text;
      const classList = context.dom.classList || [];
      const componentName = context.react?.componentName;
      
      // 从 React 组件名推断
      if (componentName) {
        names.add(`${componentName}.tsx`);
        names.add(`${componentName}.jsx`);
        names.add(`${componentName}.vue`);
      }
      
      // 从 data-component 推断
      if (context.markers?.component) {
        names.add(`${context.markers.component}.tsx`);
      }
      
      // 从类名推断（PascalCase 可能是组件）
      classList.forEach(cls => {
        if (/^[A-Z][a-zA-Z0-9]+$/.test(cls)) {
          names.add(`${cls}.tsx`);
          names.add(`${cls}/index.tsx`);
        }
        // kebab-case 转 PascalCase
        if (cls.includes('-')) {
          const pascal = cls.split('-')
            .map(s => s.charAt(0).toUpperCase() + s.slice(1))
            .join('');
          names.add(`${pascal}.tsx`);
        }
      });
      
      // 从文本内容推断（中文或英文关键词）
      const keywords = {
        '订单': ['Order', 'OrderForm', 'OrderSubmit'],
        '用户': ['User', 'UserProfile', 'UserForm'],
        '登录': ['Login', 'SignIn', 'Auth'],
        '注册': ['Register', 'SignUp'],
        '提交': ['Submit', 'FormSubmit'],
        '搜索': ['Search', 'SearchBox'],
        '首页': ['Home', 'Index'],
        '设置': ['Settings', 'Config'],
        '个人中心': ['Profile', 'Account'],
        '购物车': ['Cart', 'ShoppingCart'],
        '支付': ['Payment', 'Pay'],
        '确认': ['Confirm', 'Confirmation']
      };
      
      for (const [key, files] of Object.entries(keywords)) {
        if (text.includes(key)) {
          files.forEach(f => {
            names.add(`${f}.tsx`);
            names.add(`${f}.jsx`);
            names.add(`${f}.vue`);
          });
        }
      }
      
      return Array.from(names).slice(0, 10);
    }
    
    extractClassPatterns(className) {
      if (!className) return [];
      
      const classes = className.split(/\s+/).filter(Boolean);
      const patterns = [];
      
      classes.forEach(cls => {
        // BEM 模式
        if (cls.includes('__') || cls.includes('--')) {
          patterns.push({ type: 'bem', value: cls });
        }
        // 工具类
        else if (['btn', 'button', 'input', 'form', 'card'].some(p => cls.includes(p))) {
          patterns.push({ type: 'semantic', value: cls });
        }
        // 其他
        else {
          patterns.push({ type: 'generic', value: cls });
        }
      });
      
      return patterns;
    }
    
    extractKeywords(text) {
      if (!text) return [];
      
      // 提取有意义的词
      const words = text
        .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 2)
        .slice(0, 10);
      
      return [...new Set(words)];
    }
    
    extractPathKeywords(path) {
      return path.segments
        .map(s => s.tag)
        .filter((tag, i, arr) => arr.indexOf(tag) === i)
        .slice(-5);
    }
    
    getSemanticHints(dom) {
      const hints = [];
      
      if (dom.tag === 'button' || dom.role === 'button') {
        hints.push('button');
      }
      if (['input', 'textarea', 'select'].includes(dom.tag)) {
        hints.push('form-input');
      }
      if (dom.tag === 'a') {
        hints.push('link');
      }
      if (dom.type === 'submit') {
        hints.push('submit');
      }
      if (dom.disabled) {
        hints.push('disabled');
      }
      
      return hints;
    }
    
    getLowConfidence(context) {
      return {
        similarElements: context.neighbors.siblingCount,
        depth: context.path.depth,
        viewportPosition: this.categorizePosition(context.geometry)
      };
    }
    
    categorizePosition(geo) {
      const { relativeX, relativeY } = geo;
      const h = relativeX < 0.33 ? 'left' : relativeX < 0.66 ? 'center' : 'right';
      const v = relativeY < 0.33 ? 'top' : relativeY < 0.66 ? 'middle' : 'bottom';
      return `${v}-${h}`;
    }
    
    getContextDescription(context) {
      const dom = context.dom;
      const path = context.path;
      
      return {
        elementType: `这是一个${dom.disabled ? '禁用的' : ''}${dom.type || dom.tag}元素`,
        pageContext: `位于页面 ${path.description.slice(0, 100)}`,
        visualContext: `在视口中位置: ${this.categorizePosition(context.geometry)}`,
        contentSummary: dom.text ? `显示文本: "${dom.text}"` : '无可见文本',
        surroundingContext: `周围有 ${context.neighbors.siblingCount} 个同级元素`
      };
    }
    
    getSearchStrategy(context) {
      const steps = [];
      
      // 最高优先级：显式标记
      if (context.markers?.aiId) {
        steps.push({
          priority: 1,
          type: 'exact',
          query: `data-ai-id="${context.markers.aiId}"`,
          reason: '开发者显式标记，最可靠',
          expected: '唯一匹配'
        });
      }
      
      // React 组件名
      if (context.react?.componentName) {
        steps.push({
          priority: 2,
          type: 'component',
          query: `component:"${context.react.componentName}"`,
          reason: 'React 组件名',
          expected: '文件级匹配'
        });
      }
      
      // ID
      if (context.dom.id) {
        steps.push({
          priority: 3,
          type: 'id',
          query: `id="${context.dom.id}"`,
          reason: '元素 ID',
          expected: '全局唯一'
        });
      }
      
      // test id
      if (context.markers?.testId) {
        steps.push({
          priority: 4,
          type: 'test',
          query: `data-testid="${context.markers.testId}"`,
          reason: '测试标记',
          expected: '唯一匹配'
        });
      }
      
      // 文本 + 路径
      steps.push({
        priority: 5,
        type: 'content',
        query: `${context.dom.tag}[text*="${context.dom.text.slice(0, 20)}"]`,
        reason: '元素标签和文本内容',
        expected: '可能多个匹配'
      });
      
      // CSS 类
      if (context.dom.classList?.length > 0) {
        steps.push({
          priority: 6,
          type: 'class',
          query: `.${context.dom.classList[0]}`,
          reason: 'CSS 类名',
          expected: '可能多个匹配'
        });
      }
      
      // 路径
      steps.push({
        priority: 7,
        type: 'path',
        query: context.path.cssPath,
        reason: 'DOM 路径',
        expected: '脆弱，容易变'
      });
      
      return {
        steps: steps.sort((a, b) => a.priority - b.priority),
        recommended: steps.filter(s => s.priority <= 3).map(s => s.query)
      };
    }
    
    getSuggestions(context) {
      const suggestions = [];
      
      // 如果无显式标记，建议添加
      if (!context.markers?.aiId && !context.markers?.testId) {
        suggestions.push({
          type: 'improvement',
          message: '建议为此元素添加 data-ai-id 属性以提高定位精度',
          example: `<${context.dom.tag} data-ai-id="unique-id">`
        });
      }
      
      // 如果文本太泛化
      if (['确定', '取消', '提交'].includes(context.dom.text)) {
        suggestions.push({
          type: 'warning',
          message: '按钮文本较通用，建议添加唯一标识',
          context: '此类按钮在页面中可能有多个'
        });
      }
      
      return suggestions;
    }
  }

  // ============================================
  // UIRenderer - UI 渲染器
  // ============================================
  class UIRenderer {
    constructor(config) {
      this.config = config;
      this.elements = {
        labels: [],
        overlay: null,
        tooltip: null,
        dialog: null
      };
      this.state = {
        hoveredMarker: null,
        active: false
      };
    }
    
    // 渲染所有标记
    renderLabels(markers) {
      this.clear();
      
      markers.forEach(marker => {
        const label = this.createLabel(marker);
        document.body.appendChild(label);
        this.elements.labels.push({
          element: label,
          marker
        });
      });
      
      // 创建 overlay 和 tooltip
      this.elements.overlay = this.createOverlay();
      this.elements.tooltip = this.createTooltip();
      document.body.appendChild(this.elements.overlay);
      document.body.appendChild(this.elements.tooltip);
      
      this.state.active = true;
    }
    
    // 创建标记标签（小圆点）
    createLabel(marker) {
      const label = document.createElement('div');
      const theme = this.config.theme;
      
      label.className = 'ui-marker-label';
      label.dataset.markerId = marker.id;
      label.textContent = marker.label;
      
      Object.assign(label.style, {
        position: 'fixed',
        top: `${marker.rect.top + window.scrollY - 8}px`,
        left: `${marker.rect.left + window.scrollX}px`,
        width: theme.labelSize,
        height: theme.labelSize,
        backgroundColor: theme.primary,
        color: 'white',
        borderRadius: '50%',
        fontSize: theme.labelFontSize,
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: theme.zIndex.label,
        pointerEvents: 'none',
        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
        transition: 'transform 0.1s ease, opacity 0.2s ease',
        opacity: theme.labelOpacity,
        border: '1px solid rgba(255,255,255,0.3)'
      });
      
      return label;
    }
    
    // 创建高亮 overlay
    createOverlay() {
      const overlay = document.createElement('div');
      overlay.className = 'ui-marker-overlay';
      
      Object.assign(overlay.style, {
        position: 'fixed',
        border: this.config.theme.overlayBorder,
        backgroundColor: this.config.theme.primaryLight,
        borderRadius: '4px',
        pointerEvents: 'none',
        zIndex: this.config.theme.zIndex.overlay,
        display: 'none',
        transition: 'all 0.1s ease'
      });
      
      return overlay;
    }
    
    // 创建 tooltip
    createTooltip() {
      const tooltip = document.createElement('div');
      tooltip.className = 'ui-marker-tooltip';
      
      Object.assign(tooltip.style, {
        position: 'fixed',
        backgroundColor: this.config.theme.tooltipBg,
        color: this.config.theme.tooltipColor,
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        zIndex: this.config.theme.zIndex.tooltip,
        pointerEvents: 'none',
        display: 'none',
        maxWidth: '250px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        whiteSpace: 'pre-line',
        lineHeight: '1.5'
      });
      
      return tooltip;
    }
    
    // 显示 hover 状态
    showHover(marker, context) {
      if (!this.state.active) return;
      
      this.state.hoveredMarker = marker;
      
      // 更新 overlay 位置
      const { rect } = marker;
      Object.assign(this.elements.overlay.style, {
        display: 'block',
        top: `${rect.top + window.scrollY}px`,
        left: `${rect.left + window.scrollX}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      });
      
      // 构建 tooltip 内容
      const lines = [
        `[${marker.label}] ${context.dom.tag}`,
        context.markers?.aiId && `ID: ${context.markers.aiId}`,
        context.react?.componentName && `组件: ${context.react.componentName}`,
        context.dom.text && `文本: ${utils.truncate(context.dom.text, 40)}`,
        context.dom.className && `类名: ${utils.truncate(context.dom.className, 30)}`
      ].filter(Boolean);
      
      this.elements.tooltip.textContent = lines.join('\n');
      
      // 计算 tooltip 位置（避免超出视口）
      const tooltipHeight = 80; // 估算
      let top = rect.top + window.scrollY - tooltipHeight - 10;
      let left = rect.left + window.scrollX;
      
      // 如果上方空间不足，显示在下方
      if (top < 0) {
        top = rect.bottom + window.scrollY + 10;
      }
      
      // 防止超出右侧
      if (left + 250 > window.innerWidth) {
        left = window.innerWidth - 260;
      }
      
      Object.assign(this.elements.tooltip.style, {
        display: 'block',
        top: `${top}px`,
        left: `${left}px`
      });
      
      // 高亮对应的 label
      const labelData = this.elements.labels.find(l => l.marker.id === marker.id);
      if (labelData) {
        labelData.element.style.transform = 'scale(1.3)';
      }
    }
    
    // 隐藏 hover 状态
    hideHover() {
      this.state.hoveredMarker = null;
      
      if (this.elements.overlay) {
        this.elements.overlay.style.display = 'none';
      }
      if (this.elements.tooltip) {
        this.elements.tooltip.style.display = 'none';
      }
      
      // 重置所有 label
      this.elements.labels.forEach(l => {
        l.element.style.transform = 'scale(1)';
      });
    }
    
    // 更新标记位置（滚动或窗口大小变化时）
    updatePositions() {
      this.elements.labels.forEach(({ element, marker }) => {
        const rect = marker.element.getBoundingClientRect();
        Object.assign(element.style, {
          top: `${rect.top + window.scrollY - 10}px`,
          left: `${rect.left + window.scrollX}px`
        });
        
        // 更新缓存的 rect
        marker.rect = {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom
        };
      });
    }
    
    // 显示输入对话框
    showDialog(marker, context, onSubmit, onCancel) {
      this.hideHover();
      
      // 创建遮罩层
      const backdrop = document.createElement('div');
      backdrop.className = 'ui-marker-dialog-backdrop';
      Object.assign(backdrop.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: this.config.theme.zIndex.dialog,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      });
      
      // 创建对话框
      const dialog = document.createElement('div');
      dialog.className = 'ui-marker-dialog';
      Object.assign(dialog.style, {
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        width: '480px',
        maxWidth: '90vw',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      });
      
      // 标题
      const header = document.createElement('div');
      header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';
      header.innerHTML = `
        <div>
          <span style="background: ${this.config.theme.primary}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">[${marker.label}]</span>
          <span style="font-weight: 600; margin-left: 8px; font-size: 16px;">${context.dom.tag}</span>
          ${context.react?.componentName ? `<span style="color: #666; margin-left: 8px; font-size: 13px;">(${context.react.componentName})</span>` : ''}
        </div>
        <button class="ui-marker-close" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">&times;</button>
      `;
      
      // 元素信息
      const info = document.createElement('div');
      info.style.cssText = 'background: #f3f4f6; padding: 12px; border-radius: 6px; margin-bottom: 16px; font-size: 13px; color: #666;';
      info.innerHTML = `
        <div><strong>文本:</strong> ${context.dom.text || '无'}</div>
        ${context.markers?.aiId ? `<div><strong>ID:</strong> ${context.markers.aiId}</div>` : ''}
        <div><strong>路径:</strong> ${utils.truncate(context.path.description, 60)}</div>
      `;
      
      // 提示文字
      const prompt = document.createElement('div');
      prompt.style.cssText = 'color: #666; font-size: 14px; margin-bottom: 12px;';
      prompt.textContent = '描述你对这个元素的修改需求：';
      
      // 输入框
      const textarea = document.createElement('textarea');
      textarea.style.cssText = `
        width: 100%;
        min-height: 100px;
        padding: 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        resize: vertical;
        box-sizing: border-box;
        font-family: inherit;
        margin-bottom: 12px;
      `;
      textarea.placeholder = '例如：把按钮改成红色，文字改为"立即购买"...';
      
      // 快捷选项
      const shortcuts = document.createElement('div');
      shortcuts.style.cssText = 'margin-bottom: 16px;';
      const options = ['改颜色', '改文字', '改大小', '改位置', '添加图标'];
      shortcuts.innerHTML = '<div style="font-size: 12px; color: #999; margin-bottom: 8px;">快捷选项：</div>' +
        options.map(opt => `<button class="ui-marker-shortcut" style="
          margin-right: 8px;
          margin-bottom: 8px;
          padding: 4px 12px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
        ">${opt}</button>`).join('');
      
      // 按钮
      const buttons = document.createElement('div');
      buttons.style.cssText = 'display: flex; justify-content: flex-end; gap: 12px;';
      buttons.innerHTML = `
        <button class="ui-marker-cancel" style="
          padding: 8px 16px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        ">取消</button>
        <button class="ui-marker-submit" style="
          padding: 8px 16px;
          border: none;
          background: ${this.config.theme.primary};
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">发送给 AI</button>
      `;
      
      // 组装
      dialog.appendChild(header);
      dialog.appendChild(info);
      dialog.appendChild(prompt);
      dialog.appendChild(textarea);
      dialog.appendChild(shortcuts);
      dialog.appendChild(buttons);
      backdrop.appendChild(dialog);
      document.body.appendChild(backdrop);
      
      this.elements.dialog = backdrop;
      
      // 绑定事件
      const closeBtn = header.querySelector('.ui-marker-close');
      const cancelBtn = buttons.querySelector('.ui-marker-cancel');
      const submitBtn = buttons.querySelector('.ui-marker-submit');
      const shortcutBtns = shortcuts.querySelectorAll('.ui-marker-shortcut');
      
      const close = () => {
        backdrop.remove();
        this.elements.dialog = null;
        onCancel?.();
      };
      
      const submit = () => {
        const value = textarea.value.trim();
        if (value) {
          backdrop.remove();
          this.elements.dialog = null;
          onSubmit(value);
        }
      };
      
      closeBtn.addEventListener('click', close);
      cancelBtn.addEventListener('click', close);
      submitBtn.addEventListener('click', submit);
      
      shortcutBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const current = textarea.value;
          const prefix = current ? current + '，' : '';
          textarea.value = prefix + btn.textContent + '：';
          textarea.focus();
        });
      });
      
      // 点击遮罩关闭
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close();
      });
      
      // 快捷键
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
          submit();
        }
        if (e.key === 'Escape') {
          close();
        }
      });
      
      // 自动聚焦
      textarea.focus();
    }
    
    // 清理所有 UI
    clear() {
      // 移除 labels
      this.elements.labels.forEach(l => l.element.remove());
      this.elements.labels = [];
      
      // 移除 overlay
      if (this.elements.overlay) {
        this.elements.overlay.remove();
        this.elements.overlay = null;
      }
      
      // 移除 tooltip
      if (this.elements.tooltip) {
        this.elements.tooltip.remove();
        this.elements.tooltip = null;
      }
      
      // 移除 dialog
      if (this.elements.dialog) {
        this.elements.dialog.remove();
        this.elements.dialog = null;
      }
      
      this.state.active = false;
      this.state.hoveredMarker = null;
    }
    
    // 获取当前状态
    getState() {
      return { ...this.state };
    }
  }

  // ============================================
  // UIMarker - 主控制器
  // ============================================
  class UIMarker {
    constructor(userConfig = {}) {
      // 合并配置
      this.config = utils.mergeConfig(DEFAULT_CONFIG, userConfig);
      
      // 初始化模块
      this.scanner = new ElementScanner(this.config);
      this.collector = new ContextCollector(this.config);
      this.clueGen = new ClueGenerator(this.config);
      this.renderer = new UIRenderer(this.config);
      
      // 状态
      this.state = {
        isActive: false,
        markers: [],
        markerMap: new Map(), // 优化查找
        currentIndex: -1, // 键盘导航当前索引
        selectedMarker: null
      };
      
      // 事件处理器缓存（用于解绑）
      this.handlers = {};
      
      // 初始化
      this.init();
    }
    
    init() {
      this.bindKeyboard();
      this.bindWindowEvents();
      
      // 如果配置了自动激活
      if (this.config.autoActivate) {
        this.activate();
      }
      
      console.log('[UIMarker] 初始化完成，按', this.config.shortcut.activate, '激活');
    }
    
    // 绑定键盘事件
    bindKeyboard() {
      this.handlers.keydown = (e) => {
        // 激活快捷键
        if (utils.matchShortcut(e, this.config.shortcut.activate)) {
          e.preventDefault();
          this.toggle();
          return;
        }
        
        // 只在激活状态下处理的快捷键
        if (!this.state.isActive) return;
        
        // 停用
        if (utils.matchShortcut(e, this.config.shortcut.deactivate)) {
          e.preventDefault();
          this.deactivate();
          return;
        }
        
        // 导航
        if (this.state.markers.length > 0) {
          if (utils.matchShortcut(e, this.config.shortcut.next)) {
            e.preventDefault();
            this.navigate(1);
          } else if (utils.matchShortcut(e, this.config.shortcut.prev)) {
            e.preventDefault();
            this.navigate(-1);
          } else if (utils.matchShortcut(e, this.config.shortcut.select)) {
            e.preventDefault();
            const marker = this.state.markers[this.state.currentIndex];
            if (marker) {
              this.selectMarker(marker);
            }
          }
        }
      };
      
      document.addEventListener('keydown', this.handlers.keydown);
    }
    
    // 绑定窗口事件
    bindWindowEvents() {
      // 滚动和窗口大小变化时更新位置
      this.handlers.updatePositions = utils.throttle(() => {
        if (this.state.isActive) {
          this.renderer.updatePositions();
        }
      }, this.config.behavior.debounceMs);
      
      window.addEventListener('scroll', this.handlers.updatePositions);
      window.addEventListener('resize', this.handlers.updatePositions);
    }
    
    // 激活
    activate() {
      if (this.state.isActive) return;
      
      try {
        // 扫描元素
        this.state.markers = this.scanner.scan();
        
        if (this.state.markers.length === 0) {
          console.warn('[UIMarker] 未找到可交互元素');
          return;
        }
        
        // 构建 Map 优化查找
        this.state.markerMap.clear();
        this.state.markers.forEach(m => {
          this.state.markerMap.set(m.element, m);
          this.state.markerMap.set(m.id, m);
        });
        
        // 渲染
        this.renderer.renderLabels(this.state.markers);
        
        // 绑定鼠标事件
        this.bindMouseEvents();
        
        // 启动动态监听
        this.scanner.startDynamicWatching(() => {
          // 内容变化时刷新
          this.refresh();
        });
        
        this.state.isActive = true;
        this.state.currentIndex = 0;
        
        // 触发事件
        this.emit('activate', {
          markerCount: this.state.markers.length
        });
        
        console.log(`[UIMarker] 已激活，发现 ${this.state.markers.length} 个元素`);
        
      } catch (err) {
        console.error('[UIMarker] 激活失败:', err);
      }
    }
    
    // 停用
    deactivate() {
      if (!this.state.isActive) return;
      
      this.unbindMouseEvents();
      this.scanner.stopWatching();
      this.renderer.clear();
      
      this.state.isActive = false;
      this.state.markers = [];
      this.state.markerMap.clear();
      this.state.currentIndex = -1;
      this.state.selectedMarker = null;
      
      this.emit('deactivate');
      console.log('[UIMarker] 已停用');
    }
    
    // 切换
    toggle() {
      this.state.isActive ? this.deactivate() : this.activate();
    }
    
    // 刷新
    refresh() {
      if (!this.state.isActive) return;
      
      const wasActive = this.state.isActive;
      this.deactivate();
      if (wasActive) {
        setTimeout(() => this.activate(), 0);
      }
    }
    
    // 绑定鼠标事件
    bindMouseEvents() {
      // 使用事件委托
      this.handlers.mousemove = utils.throttle((e) => {
        const marker = this.findMarkerFromPoint(e.clientX, e.clientY);
        
        if (marker) {
          const context = this.collector.collect(marker);
          this.renderer.showHover(marker, context);
          
          // 更新当前索引
          this.state.currentIndex = this.state.markers.indexOf(marker);
        } else {
          this.renderer.hideHover();
        }
      }, this.config.behavior.debounceMs);
      
      this.handlers.click = (e) => {
        const marker = this.findMarkerFromPoint(e.clientX, e.clientY);
        
        if (marker) {
          e.preventDefault();
          e.stopPropagation();
          this.selectMarker(marker);
        }
      };
      
      document.addEventListener('mousemove', this.handlers.mousemove);
      document.addEventListener('click', this.handlers.click, true);
    }
    
    // 解绑鼠标事件
    unbindMouseEvents() {
      document.removeEventListener('mousemove', this.handlers.mousemove);
      document.removeEventListener('click', this.handlers.click, true);
    }
    
    // 从坐标查找标记
    findMarkerFromPoint(x, y) {
      // 使用 elementFromPoint 找到最上层元素
      const element = document.elementFromPoint(x, y);
      if (!element) return null;
      
      // 向上查找最近的标记元素
      let current = element;
      while (current && current !== document.body) {
        const marker = this.state.markerMap.get(current);
        if (marker) return marker;
        current = current.parentElement;
      }
      
      return null;
    }
    
    // 键盘导航
    navigate(direction) {
      const newIndex = this.state.currentIndex + direction;
      
      if (newIndex >= 0 && newIndex < this.state.markers.length) {
        this.state.currentIndex = newIndex;
        const marker = this.state.markers[newIndex];
        
        // 滚动到视野
        marker.element.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        
        // 显示 hover
        const context = this.collector.collect(marker);
        this.renderer.showHover(marker, context);
      }
    }
    
    // 选择标记
    selectMarker(marker) {
      this.state.selectedMarker = marker;
      
      const context = this.collector.collect(marker);
      const clues = this.clueGen.generate(context);
      
      this.renderer.showDialog(
        marker,
        context,
        (instruction) => {
          // 提交
          const payload = {
            version: '2.0',
            timestamp: new Date().toISOString(),
            selection: {
              markerId: marker.id,
              markerLabel: marker.label
            },
            context,
            clues,
            instruction
          };
          
          this.emit('submit', payload);
        },
        () => {
          // 取消
          this.emit('cancel');
        }
      );
    }
    
    // 手动选择（通过 label）
    selectByLabel(label) {
      const marker = this.state.markers.find(m => m.label === label);
      if (marker) {
        this.selectMarker(marker);
      }
    }
    
    // 事件发射
    emit(eventName, detail = {}) {
      const event = new CustomEvent(`uimarker:${eventName}`, {
        detail,
        bubbles: true
      });
      window.dispatchEvent(event);
    }
    
    // 公共 API
    isActive() {
      return this.state.isActive;
    }
    
    getMarkers() {
      return [...this.state.markers];
    }
    
    getConfig() {
      return utils.clone(this.config);
    }
    
    updateConfig(newConfig) {
      this.config = utils.mergeConfig(this.config, newConfig);
    }
    
    // 销毁
    destroy() {
      this.deactivate();
      document.removeEventListener('keydown', this.handlers.keydown);
      window.removeEventListener('scroll', this.handlers.updatePositions);
      window.removeEventListener('resize', this.handlers.updatePositions);
    }
  }

  // ============================================
  // 暴露到全局
  // ============================================
  
  // 创建默认实例
  const defaultInstance = new UIMarker();
  
  // 暴露 API
  window.UIMarker = UIMarker;
  window.uiMarker = defaultInstance;
  
  // 如果配置了自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[UIMarker] 已加载，按 Ctrl+Shift+M 激活');
    });
  } else {
    console.log('[UIMarker] 已加载，按 Ctrl+Shift+M 激活');
  }

})();

