/**
 * 测试侧边栏闪烁问题
 * 模拟浏览器行为，检查组件重新渲染原因
 */

console.log("=== 侧边栏闪烁问题分析 ===\n");

// 分析可能的原因
const issues = [
  {
    id: 1,
    title: "useEffect 依赖导致无限循环",
    description: "useEffect 依赖 chatController，而 chatController 可能每次渲染都创建新实例",
    check: "检查 useChatController() 是否返回稳定引用"
  },
  {
    id: 2,
    title: "状态更新触发重新渲染",
    description: "setModels() 或 setIsLoadingModels() 触发组件重新渲染，导致 useEffect 再次执行",
    check: "检查 useEffect 是否设置了正确的依赖项"
  },
  {
    id: 3,
    title: "父组件频繁重新渲染",
    description: "SidebarPanel 或父组件频繁重新渲染，导致子组件也重新渲染",
    check: "检查父组件的状态更新和渲染优化"
  },
  {
    id: 4,
    title: "API 响应触发状态更新",
    description: "chatController.listModels() 返回的数据可能每次不同，触发状态更新",
    check: "检查 API 响应数据是否稳定"
  }
];

console.log("可能的问题原因：");
issues.forEach(issue => {
  console.log(`${issue.id}. ${issue.title}`);
  console.log(`   描述: ${issue.description}`);
  console.log(`   检查: ${issue.check}\n`);
});

// 检查 ModelParamsSection.tsx 的关键代码
console.log("=== ModelParamsSection.tsx 关键代码分析 ===\n");

const problematicCode = `
useEffect(() => {
  const loadModels = async () => {
    setIsLoadingModels(true);
    try {
      const result = await chatController.listModels();
      if (result && result.models) {
        setModels(result.models);  // ⚠️ 这里可能触发重新渲染
      }
    } catch (error) {
      console.error("[ModelParamsSection] Failed to load models:", error);
    } finally {
      setIsLoadingModels(false);   // ⚠️ 这里也会触发重新渲染
    }
  };

  loadModels();
}, [chatController]);  // ⚠️ 依赖 chatController，如果不稳定会导致无限循环
`;

console.log("有问题的 useEffect:");
console.log(problematicCode);

// 解决方案建议
console.log("=== 解决方案建议 ===\n");

const solutions = [
  {
    step: 1,
    action: "使用 useRef 防止重复请求",
    code: `
const hasFetchedRef = useRef(false);

useEffect(() => {
  if (hasFetchedRef.current) return;
  
  const loadModels = async () => {
    hasFetchedRef.current = true;
    setIsLoadingModels(true);
    try {
      const result = await chatController.listModels();
      if (result && result.models) {
        setModels(result.models);
      }
    } catch (error) {
      console.error("[ModelParamsSection] Failed to load models:", error);
      hasFetchedRef.current = false; // 出错时允许重试
    } finally {
      setIsLoadingModels(false);
    }
  };

  loadModels();
}, [chatController]);
    `
  },
  {
    step: 2,
    action: "添加防抖或节流",
    code: `
const [fetchTimeout, setFetchTimeout] = useState<NodeJS.Timeout>();

useEffect(() => {
  if (fetchTimeout) clearTimeout(fetchTimeout);
  
  const timeout = setTimeout(() => {
    const loadModels = async () => {
      setIsLoadingModels(true);
      try {
        const result = await chatController.listModels();
        if (result && result.models) {
          setModels(result.models);
        }
      } catch (error) {
        console.error("[ModelParamsSection] Failed to load models:", error);
      } finally {
        setIsLoadingModels(false);
      }
    };
    
    loadModels();
  }, 500); // 500ms 防抖
  
  setFetchTimeout(timeout);
  
  return () => {
    if (fetchTimeout) clearTimeout(fetchTimeout);
  };
}, [chatController]);
    `
  },
  {
    step: 3,
    action: "使用 useMemo 缓存模型数据",
    code: `
const modelParams = useMemo(() => {
  const currentModelInfo = models.find((m) => m.id === currentModel) || models[0];
  
  return [
    {
      key: "model",
      label: "模型",
      value: currentModelInfo?.name || currentModel || "未选择",
      type: "select",
      options: models.map((m) => m.id),
      editable: true,
      description: "当前使用的AI模型",
    },
    // ... 其他参数
  ];
}, [models, currentModel]);
    `
  }
];

solutions.forEach(solution => {
  console.log(`步骤 ${solution.step}: ${solution.action}`);
  console.log(solution.code);
  console.log("---\n");
});

console.log("=== 测试步骤 ===\n");
console.log("1. 打开浏览器开发者工具 (F12)");
console.log("2. 切换到 Network 标签页");
console.log("3. 过滤请求: /api/models");
console.log("4. 观察请求频率 - 应该只有1-2次");
console.log("5. 如果频繁请求，说明有无限循环");
console.log("6. 切换到 Console 标签页，查看组件渲染日志");