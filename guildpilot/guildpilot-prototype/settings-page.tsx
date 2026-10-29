import { useState } from 'react';
import { roles } from './mock-data.js';
import { PageHead } from './layout.js';
import styles from './app.module.css';

const settings = [
  { id: 'welcome', name: 'Welcome message', desc: 'Greet new members in #welcome with rules link' },
  { id: 'autorole', name: 'Auto-role on join', desc: 'Give @Member after verification' },
  { id: 'logs', name: 'Server logs', desc: 'Post joins, leaves, edits and deletes to #mod-logs' },
  { id: 'onboarding', name: 'Onboarding', desc: 'Let members pick interests and roles on join' },
  { id: 'transcripts', name: 'Ticket transcripts', desc: 'Save closed tickets to #ticket-logs' },
];

/**
 * Roles & general server settings.
 */
export function SettingsPage() {
  const [on, setOn] = useState<Record<string, boolean>>({ welcome: true, autorole: true, logs: true, onboarding: false, transcripts: true });
  return (
    <>
      <PageHead title="Roles & Settings" subtitle="Manage role hierarchy, permissions and server-wide behavior." action={<button className={styles.btn}>+ New role</button>} />
      <div className={styles.grid2}>
        <div className={styles.card}>
          <h3>Role hierarchy</h3>
          {roles.map((r) => (
            <div key={r.name} className={styles.row}>
              <span className={styles.dot} style={{ background: r.color }} />
              <div className={styles.grow}><strong>{r.name}</strong><div className={styles.muted}>{r.members.toLocaleString()} members</div></div>
              {r.dangerous && <span className={`${styles.pill} ${styles.warning}`}>⚠ {r.dangerous.join(', ')}</span>}
              <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`}>Edit</button>
            </div>
          ))}
        </div>
        <div className={styles.card}>
          <h3>Server automations</h3>
          {settings.map((s) => (
            <div key={s.id} className={styles.row}>
              <div className={styles.grow}>{s.name}<div className={styles.muted}>{s.desc}</div></div>
              <button aria-label={`Toggle ${s.name}`} className={`${styles.toggle} ${on[s.id] ? styles.toggleOn : ''}`} onClick={() => setOn({ ...on, [s.id]: !on[s.id] })} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
