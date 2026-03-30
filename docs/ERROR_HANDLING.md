# 文件浏览器错误处理指南

## 概述

本文档描述了文件浏览器组件的错误处理策略和最佳实践。

## 错误边界架构

### 1. 通用错误边界 (ErrorBoundary.tsx)
```typescript
// 基本用法
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>

// 自定义fallback
<ErrorBoundary fallback={<CustomErrorUI />}>
  <YourComponent />
</ErrorBoundary>

// 错误回调
<ErrorBoundary onError={(error, errorInfo) => {
  console.error('Component error:', error);
  // 发送到错误跟踪服务
}}>
  <YourComponent />
</ErrorBoundary>

// 高阶组件
const WrappedComponent = withErrorBoundary(YourComponent, {
  fallback: <CustomErrorUI />,
  onError: handleError
});
```

### 2. 文件浏览器专用错误边界 (FileBrowserErrorBoundary.tsx)
```typescript
// 包装特定组件
<FileBrowserErrorBoundary componentName="File Sidebar">
  <FileSidebar />
</FileBrowserErrorBoundary>

// 使用预定义的包装器
<FileViewerWithErrorBoundary>
  <FileViewer />
</FileViewerWithErrorBoundary>
```

## 错误类型和处理策略

### 1. API错误
```typescript
// FileBrowser.tsx中的示例
try {
  const data = await browseDirectory(path);
  // 处理成功
} catch (err) {
  const errorMessage = err instanceof Error ? err.message : 'Failed to load directory';
  
  // 特定错误类型的友好消息
  if (errorMessage.includes('permission')) {
    setError(`Permission denied: Cannot access "${path}". You may need to check file permissions.`);
  } else if (errorMessage.includes('ENOENT')) {
    setError(`Directory not found: "${path}" does not exist or cannot be accessed.`);
  } else if (errorMessage.includes('network')) {
    setError(`Network error: Cannot connect to server. Please check your connection.`);
  } else {
    setError(errorMessage);
  }
}
```

### 2. 组件渲染错误
```typescript
// 由错误边界自动捕获
// 组件崩溃时显示备用UI
```

### 3. 用户输入错误
```typescript
// 验证用户输入
const handleExecute = async () => {
  if (!selectedActionFile) {
    setError('No file selected for execution');
    return;
  }
  
  if (!isExecutable) {
    setError('Selected file is not executable');
    return;
  }
  
  // 执行文件
};
```

### 4. 状态错误
```typescript
// 检查状态一致性
const handleSave = async () => {
  if (mode !== 'edit') {
    console.error('Attempted to save while not in edit mode');
    return;
  }
  
  if (!filePath) {
    setError('No file path specified for saving');
    return;
  }
  
  // 保存文件
};
```

## 错误处理钩子

### 1. useErrorHandler (通用)
```typescript
const { error, handleError, clearError } = useErrorHandler();

useEffect(() => {
  try {
    // 可能抛出错误的操作
    riskyOperation();
  } catch (err) {
    handleError(err instanceof Error ? err : new Error(String(err)));
  }
}, []);

if (error) {
  return <ErrorDisplay error={error} onRetry={clearError} />;
}
```

### 2. useFileBrowserErrorHandler (文件浏览器专用)
```typescript
const { 
  error, 
  errorContext, 
  errorMessage, 
  handleError, 
  clearError 
} = useFileBrowserErrorHandler();

const loadFile = async (path: string) => {
  try {
    const content = await readFile(path);
    // 处理内容
  } catch (err) {
    handleError(err instanceof Error ? err : new Error(String(err)), 'loadFile');
  }
};
```

## 错误消息最佳实践

### 1. 用户友好的消息
```typescript
// 不好
setError('ENOENT: no such file or directory');

// 好
setError(`File not found: "${fileName}" does not exist. Please check the file name and try again.`);
```

### 2. 提供解决方案
```typescript
// 不好
setError('Permission denied');

// 好
setError(`Permission denied: Cannot access "${path}". 
- Check if you have read permissions
- Try running with administrator privileges
- Contact your system administrator`);
```

### 3. 技术细节可访问
```typescript
// 显示用户友好消息，但提供技术细节
<div className="error-details">
  <p className="user-message">{userFriendlyMessage}</p>
  <details className="technical-details">
    <summary>Technical details</summary>
    <pre>{technicalError}</pre>
  </details>
</div>
```

## 错误恢复策略

### 1. 自动重试
```typescript
const retryOperation = async (operation: () => Promise<any>, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // 指数退避
    }
  }
};
```

### 2. 降级功能
```typescript
const loadWithFallback = async () => {
  try {
    return await loadFromPrimarySource();
  } catch (err) {
    console.warn('Primary source failed, using fallback');
    return await loadFromFallbackSource();
  }
};
```

### 3. 用户控制的重试
```typescript
const ErrorDisplay = ({ error, onRetry }) => (
  <div className="error-display">
    <p>{error.message}</p>
    <button onClick={onRetry}>Retry</button>
    <button onClick={() => window.location.reload()}>Reload Page</button>
  </div>
);
```

## 错误日志和监控

### 1. 控制台日志
```typescript
// 结构化日志
console.error('FileBrowser error:', {
  component: 'FileViewer',
  operation: 'saveFile',
  error: err.message,
  stack: err.stack,
  timestamp: new Date().toISOString(),
  userInfo: { filePath, mode }
});
```

### 2. 错误跟踪服务集成
```typescript
// 示例：集成Sentry-like服务
const trackError = (error: Error, context: Record<string, any>) => {
  // 发送到错误跟踪服务
  if (window.errorTrackingService) {
    window.errorTrackingService.captureException(error, { extra: context });
  }
  
  // 也记录到控制台
  console.error('Tracked error:', error, context);
};

// 在错误边界中使用
componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  trackError(error, {
    component: this.props.componentName,
    errorInfo: errorInfo.componentStack,
    location: window.location.href
  });
}
```

### 3. 性能监控
```typescript
// 监控操作性能
const monitorOperation = async (operationName: string, operation: () => Promise<any>) => {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    
    // 记录成功操作
    console.debug(`Operation ${operationName} completed in ${duration}ms`);
    
    // 如果操作太慢，记录警告
    if (duration > 1000) {
      console.warn(`Operation ${operationName} took ${duration}ms (slow)`);
    }
    
    return result;
  } catch (err) {
    const duration = performance.now() - startTime;
    
    // 记录失败操作
    console.error(`Operation ${operationName} failed after ${duration}ms:`, err);
    
    throw err;
  }
};
```

## 测试错误处理

### 1. 单元测试
```typescript
// 测试错误边界
it('displays fallback UI when error occurs', () => {
  const ErrorThrowingComponent = () => {
    throw new Error('Test error');
  };
  
  render(
    <ErrorBoundary>
      <ErrorThrowingComponent />
    </ErrorBoundary>
  );
  
  expect(screen.getByText('Something went wrong')).toBeInTheDocument();
});

// 测试API错误处理
it('handles API errors gracefully', async () => {
  const { browseDirectory } = await import('@/services/api/fileApi');
  (browseDirectory as any).mockRejectedValue(new Error('Network error'));
  
  render(<FileBrowser />);
  
  await waitFor(() => {
    expect(screen.getByText(/Network error/)).toBeInTheDocument();
  });
});
```

### 2. 集成测试
```typescript
// 测试完整错误流程
it('recovers from error after retry', async () => {
  let failOnce = true;
  const { browseDirectory } = await import('@/services/api/fileApi');
  
  (browseDirectory as any).mockImplementation(() => {
    if (failOnce) {
      failOnce = false;
      return Promise.reject(new Error('Temporary failure'));
    }
    return Promise.resolve({ items: [] });
  });
  
  render(<FileBrowser />);
  
  // 应该显示错误
  await waitFor(() => {
    expect(screen.getByText(/Temporary failure/)).toBeInTheDocument();
  });
  
  // 点击重试
  fireEvent.click(screen.getByText('Retry'));
  
  // 应该成功加载
  await waitFor(() => {
    expect(screen.queryByText(/Temporary failure/)).not.toBeInTheDocument();
  });
});
```

## 最佳实践总结

1. **防御性编程**: 总是验证输入和状态
2. **优雅降级**: 当功能失败时提供备用方案
3. **用户友好**: 显示可操作的错误消息
4. **详细日志**: 记录足够信息用于调试
5. **监控告警**: 设置错误监控和告警
6. **测试覆盖**: 测试所有错误路径
7. **渐进增强**: 核心功能应该总是可用
8. **快速失败**: 尽早检测和处理错误
9. **透明沟通**: 让用户知道发生了什么
10. **持续改进**: 从错误中学习并改进系统