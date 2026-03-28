/**
 * App - Gateway Main Application
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from './components/ui/Button/Button';
import { chatController } from './controllers';
import { fileController } from './controllers';
import { sessionController } from './controllers';
import { useNewChatStore } from './store/new-chat.store';
import { ChatPanel } from './components/chat/ChatPanel/ChatPanel';
import { FileBrowser } from './components/files/FileBrowser';
import { SidebarPanel } from './components/layout/SidebarPanel/SidebarPanel';
import { BottomMenu } from './components/layout/BottomMenu';
import './styles/global.css';
import './styles/ui-optimized.css';
import './styles/animations.css';
import styles from './App.module.css';

function App() {
  const [currentView, setCurrentView] = useState<'chat' | 'files'>('chat');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crashInfo, setCrashInfo] = useState<string | null>(null);
  const [initStep, setInitStep] = useState<string>('starting');
  
  const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });

  // Global error capture
  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      const info = `ERROR: ${e.message}\n at ${e.filename}:${e.lineno}`;
      console.error(info);
      setCrashInfo(info);
    };
    const handleRejection = (e: PromiseRejectionEvent) => {
      const info = `REJECTION: ${String(e.reason)}`;
      console.error(info);
      setCrashInfo(info);
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);
  
  // Initialization
  useEffect(() => {
    async function initApp() {
      try {
        setIsLoading(true);
        setInitStep('settings');
        
        const settings = await sessionController.getUserSettings();
        console.log('Settings loaded:', settings);
        
        setInitStep('workspace');
        const workspace = await sessionController.getCurrentWorkspace();
        console.log('Workspace loaded:', workspace);
        
        setInitStep('fileController');
        fileController.setCurrentPath(workspace.path);
        
        setInitStep('websocket');
        chatController.initWebSocketConnection().catch(err => {
          console.warn('WebSocket failed:', err);
        });
        
        setInitStep('done');
        setIsLoading(false);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('Init failed:', errorMsg);
        setError(`Step [${initStep}]: ${errorMsg}`);
        setIsLoading(false);
      }
    }
    
    initApp();
    
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarVisible(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Crash display
  if (crashInfo) {
    return (
      <div style={{padding: '20px', background: '#0f0f1a', color: '#ff6b6b', minHeight: '100vh', fontFamily: 'monospace'}}>
        <h2>💥 CRASH</h2>
        <pre style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '14px'}}>{crashInfo}</pre>
        <button onClick={() => window.location.reload()} style={{marginTop: '20px', padding: '10px 20px'}}>
          Reload
        </button>
      </div>
    );
  }

  // Error display
  if (error) {
    return (
      <div style={{padding: '20px', background: '#0f0f1a', color: '#ff6b6b', minHeight: '100vh'}}>
        <h2>❌ Error</h2>
        <p>Step: {initStep}</p>
        <pre style={{whiteSpace: 'pre-wrap'}}>{error}</pre>
        <button onClick={() => window.location.reload()} style={{marginTop: '20px', padding: '10px 20px'}}>
          Retry
        </button>
      </div>
    );
  }

  // Loading display
  if (isLoading) {
    return (
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f0f1a', color: 'white'}}>
        <div style={{textAlign: 'center'}}>
          <div style={{display: 'inline-block', width: '40px', height: '40px', border: '4px solid #30363d', borderTopColor: '#58a6ff', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px'}}></div>
          <p>Loading... [{initStep}]</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Main app
  return (
    <div className={styles.app}>
      <header className={styles.appHeader}>
        <div className={styles.headerLeft}>
          <h1 className={styles.appTitle}>Pi Gateway</h1>
          <div className={styles.viewSwitcher}>
            <button onClick={() => setCurrentView('chat')} style={{padding: '6px 12px', background: currentView === 'chat' ? '#58a6ff' : 'transparent', border: 'none', color: 'white', borderRadius: '4px'}}>Chat</button>
            <button onClick={() => setCurrentView('files')} style={{padding: '6px 12px', background: currentView === 'files' ? '#58a6ff' : 'transparent', border: 'none', color: 'white', borderRadius: '4px'}}>Files</button>
          </div>
        </div>
        <div className={styles.headerCenter}>
          <span style={{color: '#3fb950'}}>● Connected</span>
        </div>
        <div className={styles.headerRight}>
          <button style={{background: 'transparent', border: 'none', color: 'white'}}>Settings</button>
        </div>
      </header>

      <main className={styles.appMain}>
        {currentView === 'chat' ? (
          <div style={{display: 'flex', height: '100%'}}>
            <div className={styles.chatSidebar} style={{display: isSidebarVisible ? 'block' : 'none'}}>
              <SidebarPanel 
                isVisible={isSidebarVisible}
                onSwitchView={setCurrentView}
                currentView={currentView}
              />
            </div>
            <div style={{flex: 1, overflowY: 'auto'}}>
              <ChatPanel />
            </div>
          </div>
        ) : (
          <div style={{height: '100%', overflowY: 'auto'}}>
            <FileBrowser />
          </div>
        )}
      </main>

      <footer style={{borderTop: '1px solid #30363d', background: '#161b22'}}>
        <BottomMenu
          isSidebarVisible={isSidebarVisible}
          currentView={currentView}
          onToggleSidebar={() => setIsSidebarVisible(!isSidebarVisible)}
          onSwitchView={setCurrentView}
        />
      </footer>
    </div>
  );
}

export default App;
