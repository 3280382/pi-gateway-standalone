# AI Tmux Controller Usage Guide

## Overview

As AI, you are now running in the **bottom pane** (started via `pi`), and can directly control the development environment.

Three-pane layout:
- **Top Left (0)**: Frontend service (Vite)
- **Top Right (1)**: Backend service (tsx watch)  
- **Bottom (2)**: AI interaction pane (pi) - you are here

## Quick Start

The bottom pane has already started `pi`, and you are running here. You can control the other two panes via the tmux controller:

## Quick Start

```javascript
import controller from '/root/pi-gateway-standalone/scripts/tmux-controller.js';

// Initialize check
if (!controller.init()) {
  // Session doesn't exist, create
  controller.createSession();
}

// Get status
const status = await controller.getStatus();
console.log(status);
```

## Available Methods

### Status Check

```javascript
// Get full status
const status = await controller.getStatus();
// {
//   session: true,
//   frontend: { pid: '12345', healthy: true, port: 5173 },
//   backend: { pid: '12346', healthy: true, port: 3000 }
// }

// Print status
await controller.printStatus();
```

### Service Control

```javascript
// Start services
await controller.startFrontend();
await controller.startBackend();

// Stop services
controller.stopFrontend();
controller.stopBackend();

// Restart services
await controller.restartFrontend();
await controller.restartBackend();
await controller.restartAll();
```

### Cache Management

```javascript
// Clear Vite cache
controller.clearCache();
```

### Auto Repair

```javascript
// Auto detect and fix issues
await controller.autoFix();
// This will:
// 1. Check if session exists
// 2. Check if backend is running
// 3. Check if frontend is running
// 4. Auto start missing services
```

### Execute Commands in AI Pane

```javascript
// Execute any command in bottom pane
controller.runInAIPane('ls -la');
controller.runInAIPane('npm run typecheck');
```

## Typical Workflows

### Handling Vite Errors

```javascript
// When AI detects "Failed to load url" error:

// 1. Clear cache
controller.clearCache();

// 2. Restart frontend
await controller.restartFrontend();

// 3. Verify
const health = await controller.checkFrontendHealth();
if (health) {
  console.log('Fix successful');
} else {
  console.log('Further inspection needed');
}
```

### Daily Development Start

```javascript
// Auto ensure environment is ready
await controller.autoFix();
```

### After Modifying Config Files

```javascript
// After modifying vite.config.ts or index.html
await controller.restartFrontend();
```

## Collaboration Workflow with Users

Although AI can automatically operate, you still need to inform the user:

```
AI: "Frontend path error detected, automatically restarting frontend service..."
[Execute controller.restartFrontend()]
AI: "✅ Frontend restarted, please observe top-left pane to confirm service started normally, log file: logs/frontend_*.log"
```

## Log Files

Service output is displayed in tmux pane and saved to separate log files:

- **Frontend Logs**: `logs/frontend_YYYYMMDD_HHMMSS.log`
- **Backend Logs**: `logs/backend_YYYYMMDD_HHMMSS.log`
- **Log Location**: `/root/pi-gateway-standalone/logs/`

Each service restart creates new log files, with timestamp in filename to ensure uniqueness.

## Notes

1. **User Observation**: Operations are displayed in bottom pane, user can see command execution
2. **Log Retention**: All output is simultaneously saved to log files for traceability
3. **Concurrency Safety**: Don't repeatedly execute same command in short time
4. **Error Handling**: Methods return boolean indicating success/failure
5. **Log Uniqueness**: Each start creates new log file, avoiding conflicts with other projects

## CLI Usage

Can also be used directly from command line:

```bash
node scripts/tmux-controller.js status
node scripts/tmux-controller.js autofix
node scripts/tmux-controller.js restart-frontend
```
