import { useState } from 'react';
import { modActions } from './mock-data.js';
import { PageHead } from './layout.js';
import styles from './app.module.css';

const autoModRules = [
  { id: 'spam', name: 'Mention spam', desc: 'Block messages with 5+ mentions' },
  { id: 'links', name: 'Scam & phishing links', desc: 'Block known malicious domains' },
  { id: 'raid', name: 'Raid protection', desc: 'Kick accounts younger than 1 day during join spikes' },
  { id: 'words', name: 'Profanity filter', desc: 'Custom keyword blocklist' },
  { id: 'caps', name: 'Caps lock spam', desc: 'Warn on 70%+ capital letters' },
];

/**
 * Moderation center — AutoMod rules and the moderation log.
 */
export function ModerationPage() {
  const [on, setOn] = useState<Record<string, boolean>>({ spam: true, links: true, raid: true, words: false, caps: false });
  return (
    <>
      <PageHead title="Moderation" subtitle="AutoMod protection and a full log of every staff and bot action." />
      <div className={styles.grid2}>
        <div className={styles.card}>
          <h3>Moderation log</h3>
          {modActions.map((m) => (
            <div key={m.id} className={styles.row}>
              <span className={`${styles.pill} ${m.action === 'Ban' || m.action === 'Kick' ? styles.critical : m.action === 'AutoMod' ? styles.upgrade : styles.warning}`}>{m.action}</span>
              <div className={styles.grow}>{m.target}<div className={styles.muted}>{m.reason}</div></div>
              <span className={styles.muted}>{m.moderator} · {m.time}</span>
            </div>
          ))}
        </div>
        <div className={styles.card}>
          <h3>AutoMod rules</h3>
          {autoModRules.map((r) => (
            <div key={r.id} className={styles.row}>
              <div className={styles.grow}>{r.name}<div className={styles.muted}>{r.desc}</div></div>
              <button aria-label={`Toggle ${r.name}`} className={`${styles.toggle} ${on[r.id] ? styles.toggleOn : ''}`} onClick={() => setOn({ ...on, [r.id]: !on[r.id] })} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
