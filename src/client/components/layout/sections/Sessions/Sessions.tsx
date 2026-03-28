/**
 * Sessions Section
 */

import { SectionHeader, IconButton } from '../../../ui';
import { useSidebarStore } from '../../../../store/sidebarStore';
import { useSidebarController } from '../../../../api/sidebarApi';
import { useChatStore } from '../../../../store/chatStore';
import type { Session } from '../../../../types/sidebar';
import styles from './Sessions.module.css';

export function Sessions() {
  const sessions = useSidebarStore((state) => state.sessions);
  const selectedId = useSidebarStore((state) => state.selectedSessionId);
  const isLoading = useSidebarStore((state) => state.isLoading);
  const controller = useSidebarController();
  const loadSession = useChatStore((state) => state.loadSession);

  const handleNewSession = () => {
    controller.createNewSession();
  };

  const handleSelectSession = async (sessionId: string) => {
    controller.selectSession(sessionId);
    // Load session messages into chat
    try {
      await loadSession(sessionId);
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  };

  if (isLoading && sessions.length === 0) {
    return (
      <section className={styles.section}>
        <SectionHeader title="Sessions" />
        <div className={styles.loading}>Loading...</div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <SectionHeader
        title="Sessions"
        action={
          <IconButton onClick={handleNewSession} title="New Session">
            <PlusIcon />
          </IconButton>
        }
      />
      <div className={styles.list}>
        {sessions.length === 0 ? (
          <div className={styles.empty}>No sessions yet</div>
        ) : (
          sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isSelected={session.id === selectedId}
              onClick={() => handleSelectSession(session.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function SessionItem({
  session,
  isSelected,
  onClick,
}: {
  session: Session;
  isSelected: boolean;
  onClick: () => void;
}) {
  const timeStr = new Date(session.lastModified).toLocaleDateString();

  return (
    <button
      className={`${styles.item} ${isSelected ? styles.selected : ''}`}
      onClick={onClick}
    >
      <div className={styles.icon}>
        <MessageIcon />
      </div>
      <div className={styles.info}>
        <div className={styles.name}>{session.name}</div>
        <div className={styles.meta}>
          {timeStr} • {session.messageCount} msgs
        </div>
      </div>
    </button>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
