/**
 * MessageItem - Compact message display with syntax highlighting
 */

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message, MessageContent } from '../../../types/chat';
import styles from './MessageItem.module.css';

interface MessageItemProps {
  message: Message;
  showThinking: boolean;
  onToggleCollapse: () => void;
  onToggleThinking: () => void;
}

export function MessageItem({
  message,
  showThinking,
  onToggleCollapse,
  onToggleThinking,
}: MessageItemProps) {
  const isUser = message.role === 'user';
  const isCollapsed = message.isMessageCollapsed ?? false;
  const [showAction, setShowAction] = useState(false);

  const thinkingContent = message.content.find((c) => c.type === 'thinking');
  const textContent = message.content.find((c) => c.type === 'text');
  const toolContent = message.content.filter((c) => c.type === 'tool');

  return (
    <div
      className={`${styles.message} ${isUser ? styles.user : styles.assistant}`}
      onMouseEnter={() => setShowAction(true)}
      onMouseLeave={() => setShowAction(false)}
    >
      <div className={`${styles.leftLine} ${isUser ? styles.userLine : styles.assistantLine}`} />

      <div className={styles.inner}>
        <div className={styles.header}>
          <span className={styles.roleIcon}>{isUser ? '👤' : 'π'}</span>
          <span className={styles.role}>{isUser ? 'You' : 'AI'}</span>
          <span className={styles.time}>{formatTime(message.timestamp)}</span>
          <button
            className={`${styles.collapseBtn} ${showAction ? styles.visible : ''}`}
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? '+' : '-'}
          </button>
        </div>

        {!isCollapsed && (
          <div className={styles.content}>
            {showThinking && thinkingContent && (
              <ThinkingBlock
                content={thinkingContent}
                isCollapsed={message.isThinkingCollapsed}
                onToggle={onToggleThinking}
              />
            )}

            {textContent?.text && (
              <MessageText text={textContent.text} />
            )}

            {toolContent.length > 0 && (
              <div className={styles.tools}>
                {toolContent.map((tool, index) => (
                  <ToolBlock key={index} content={tool} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Detect if text needs special formatting
function detectFormat(text: string): 'markdown' | 'json' | 'terminal' | 'plain' {
  const trimmed = text.trim();
  
  // JSON detection - starts with { or [ and is valid JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON, continue checking
    }
  }
  
  // Terminal/command output detection
  // Contains $ prompt, > prompt, or typical command output patterns
  if (/^\$\s|^>\s|^[\w\-]+@[\w\-]+:~|error:|warning:|\|\s+\w+\s+\|/.test(trimmed) ||
      (trimmed.includes('\n') && /\$\s+\w+/.test(trimmed))) {
    return 'terminal';
  }
  
  // Markdown detection
  if (/```|[#*\-_\[\]\(\)|`>|\|]/.test(text)) {
    return 'markdown';
  }
  
  return 'plain';
}

// Simple text component with smart format detection
function MessageText({ text }: { text: string }) {
  const format = detectFormat(text);
  
  switch (format) {
    case 'json':
      return <JsonBlock content={text} />;
    case 'terminal':
      return <TerminalBlock content={text} />;
    case 'markdown':
      return (
        <div className={styles.text}>
          <ReactMarkdown
            components={{
              code: CodeBlock,
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
      );
    default:
      return <div className={styles.text}>{text}</div>;
  }
}

function JsonBlock({ content }: { content: string }) {
  try {
    const parsed = JSON.parse(content.trim());
    return (
      <pre className={styles.jsonBlock}>
        <code>{JSON.stringify(parsed, null, 2)}</code>
      </pre>
    );
  } catch {
    return <div className={styles.text}>{content}</div>;
  }
}

function TerminalBlock({ content }: { content: string }) {
  return (
    <div className={styles.terminalBlock}>
      <div className={styles.terminalHeader}>
        <span>terminal</span>
      </div>
      <pre className={styles.terminalContent}>
        <code>{content}</code>
      </pre>
    </div>
  );
}

function CodeBlock({ inline, className, children }: { inline?: boolean; className?: string; children: string }) {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  
  if (inline) {
    return <code className={styles.inlineCode}>{children}</code>;
  }
  
  // No language specified - use simple pre/code without syntax highlighting overhead
  if (!language) {
    return (
      <pre className={styles.simpleCodeBlock}>
        <code>{String(children).replace(/\n$/, '')}</code>
      </pre>
    );
  }
  
  return (
    <div className={styles.codeBlock}>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: '6px 8px',
          fontSize: '9px',
          lineHeight: '1.3',
          borderRadius: '4px',
          maxHeight: '150px',
          overflow: 'auto',
        }}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  );
}

function ThinkingBlock({
  content,
  isCollapsed,
  onToggle,
}: {
  content: MessageContent;
  isCollapsed?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={styles.thinkingBlock}>
      <button className={styles.thinkingHeader} onClick={onToggle}>
        <span>thinking</span>
        <span>{isCollapsed ? '+' : '-'}</span>
      </button>
      {!isCollapsed && content.thinking && (
        <pre className={styles.thinkingContent}>{content.thinking}</pre>
      )}
    </div>
  );
}

function ToolBlock({ content }: { content: MessageContent }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const status = content.error ? 'error' : content.output ? 'success' : 'executing';

  return (
    <div className={`${styles.toolBlock} ${styles[status]}`}>
      <button className={styles.toolHeader} onClick={() => setIsExpanded(!isExpanded)}>
        <span className={styles.toolIcon}>$</span>
        <span className={styles.toolName}>{content.toolName}</span>
        <span>{isExpanded ? '-' : '+'}</span>
      </button>
      {isExpanded && (
        <div className={styles.toolContent}>
          {content.args && Object.keys(content.args).length > 0 && (
            <pre className={styles.code}>{JSON.stringify(content.args, null, 2)}</pre>
          )}
          {content.output && (
            <TerminalBlock content={content.output} />
          )}
          {content.error && (
            <pre className={`${styles.code} ${styles.errorText}`}>{content.error}</pre>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}
