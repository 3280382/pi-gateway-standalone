# File Browser Error Handling Guide

## Overview

This document describes the error handling strategy and best practices for the file browser component.

## Error Boundary Architecture

### 1. Generic Error Boundary (ErrorBoundary.tsx)
```typescript
// Basic usage
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>

// Custom fallback
<ErrorBoundary fallback={<CustomErrorUI />}>
  <YourComponent />
</ErrorBoundary>

// Error callback
<ErrorBoundary onError={(error, errorInfo) => {
  console.error('Component error:', error);
  // Send to error tracking service
}}>
  <YourComponent />
</ErrorBoundary>

// Higher-order component
const WrappedComponent = withErrorBoundary(YourComponent, {
  fallback: <CustomErrorUI />,
  onError: handleError
});
```

### 2. File Browser Specific Error Boundary (FileBrowserErrorBoundary.tsx)
```typescript
// Wrap specific components
<FileBrowserErrorBoundary componentName="File Sidebar">
  <FileSidebar />
</FileBrowserErrorBoundary>

// Use predefined wrapper
<FileViewerWithErrorBoundary>
  <FileViewer />
</FileViewerWithErrorBoundary>
```

## Error Types and Handling Strategies

### 1. API Errors
```typescript
// Example in FileBrowser.tsx
try {
  const data = await browseDirectory(path);
  // Handle success
} catch (err) {
  const errorMessage = err instanceof Error ? err.message : 'Failed to load directory';
  
  // Friendly messages for specific error types
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

### 2. Component Rendering Errors
```typescript
// Automatically caught by error boundary
// Display fallback UI when component crashes
```

### 3. User Input Errors
```typescript
// Validate user input
const handleExecute = async () => {
  if (!selectedActionFile) {
    setError('No file selected for execution');
    return;
  }
  
  if (!isExecutable) {
    setError('Selected file is not executable');
    return;
  }
  
  // Execute file
};
```

### 4. State Errors
```typescript
// Check state consistency
const handleSave = async () => {
  if (mode !== 'edit') {
    console.error('Attempted to save while not in edit mode');
    return;
  }
  
  if (!filePath) {
    setError('No file path specified for saving');
    return;
  }
  
  // Save file
};
```

## Error Handling Hooks

### 1. useErrorHandler (Generic)
```typescript
const { error, handleError, clearError } = useErrorHandler();

useEffect(() => {
  try {
    // Operation that may throw error
    riskyOperation();
  } catch (err) {
    handleError(err instanceof Error ? err : new Error(String(err)));
  }
}, []);

if (error) {
  return <ErrorDisplay error={error} onRetry={clearError} />;
}
```

### 2. useFileBrowserErrorHandler (File Browser Specific)
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
    // Process content
  } catch (err) {
    handleError(err instanceof Error ? err : new Error(String(err)), 'loadFile');
  }
};
```

## Error Message Best Practices

### 1. User-Friendly Messages
```typescript
// Bad
setError('ENOENT: no such file or directory');

// Good
setError(`File not found: "${fileName}" does not exist. Please check the file name and try again.`);
```

### 2. Provide Solutions
```typescript
// Bad
setError('Permission denied');

// Good
setError(`Permission denied: Cannot access "${path}". 
- Check if you have read permissions
- Try running with administrator privileges
- Contact your system administrator`);
```

### 3. Technical Details Accessible
```typescript
// Display user-friendly message, but provide technical details
<div className="error-details">
  <p className="user-message">{userFriendlyMessage}</p>
  <details className="technical-details">
    <summary>Technical details</summary>
    <pre>{technicalError}</pre>
  </details>
</div>
```

## Error Recovery Strategies

### 1. Automatic Retry
```typescript
const retryOperation = async (operation: () => Promise<any>, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
    }
  }
};
```

### 2. Graceful Degradation
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

### 3. User-Controlled Retry
```typescript
const ErrorDisplay = ({ error, onRetry }) => (
  <div className="error-display">
    <p>{error.message}</p>
    <button onClick={onRetry}>Retry</button>
    <button onClick={() => window.location.reload()}>Reload Page</button>
  </div>
);
```

## Error Logging and Monitoring

### 1. Console Logging
```typescript
// Structured logging
console.error('FileBrowser error:', {
  component: 'FileViewer',
  operation: 'saveFile',
  error: err.message,
  stack: err.stack,
  timestamp: new Date().toISOString(),
  userInfo: { filePath, mode }
});
```

### 2. Error Tracking Service Integration
```typescript
// Example: Sentry-like service integration
const trackError = (error: Error, context: Record<string, any>) => {
  // Send to error tracking service
  if (window.errorTrackingService) {
    window.errorTrackingService.captureException(error, { extra: context });
  }
  
  // Also log to console
  console.error('Tracked error:', error, context);
};

// Use in error boundary
componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  trackError(error, {
    component: this.props.componentName,
    errorInfo: errorInfo.componentStack,
    location: window.location.href
  });
}
```

### 3. Performance Monitoring
```typescript
// Monitor operation performance
const monitorOperation = async (operationName: string, operation: () => Promise<any>) => {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    
    // Log successful operation
    console.debug(`Operation ${operationName} completed in ${duration}ms`);
    
    // Log warning if operation is too slow
    if (duration > 1000) {
      console.warn(`Operation ${operationName} took ${duration}ms (slow)`);
    }
    
    return result;
  } catch (err) {
    const duration = performance.now() - startTime;
    
    // Log failed operation
    console.error(`Operation ${operationName} failed after ${duration}ms:`, err);
    
    throw err;
  }
};
```

## Testing Error Handling

### 1. Unit Tests
```typescript
// Test error boundary
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

// Test API error handling
it('handles API errors gracefully', async () => {
  const { browseDirectory } = await import('@/services/api/fileApi');
  (browseDirectory as any).mockRejectedValue(new Error('Network error'));
  
  render(<FileBrowser />);
  
  await waitFor(() => {
    expect(screen.getByText(/Network error/)).toBeInTheDocument();
  });
});
```

### 2. Integration Tests
```typescript
// Test complete error flow
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
  
  // Should display error
  await waitFor(() => {
    expect(screen.getByText(/Temporary failure/)).toBeInTheDocument();
  });
  
  // Click retry
  fireEvent.click(screen.getByText('Retry'));
  
  // Should load successfully
  await waitFor(() => {
    expect(screen.queryByText(/Temporary failure/)).not.toBeInTheDocument();
  });
});
```

## Best Practices Summary

1. **Defensive Programming**: Always validate input and state
2. **Graceful Degradation**: Provide fallback solutions when features fail
3. **User-Friendly**: Display actionable error messages
4. **Detailed Logging**: Log sufficient information for debugging
5. **Monitoring Alerts**: Set up error monitoring and alerting
6. **Test Coverage**: Test all error paths
7. **Progressive Enhancement**: Core features should always be available
8. **Fail Fast**: Detect and handle errors early
9. **Transparent Communication**: Let users know what's happening
10. **Continuous Improvement**: Learn from errors and improve the system
