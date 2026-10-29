import { useState } from 'react';
import { auditFindings, type Server, type Severity } from './mock-data.js';
import { HealthRing } from './health-ring.js';
import { PageHead } from './layout.js';
import styles from './app.module.css';

/**
 * Health audit — lists issues and upgrade suggestions, with one-click fixes that raise the score.
 * @param props.server - The selected server.
 */
export function AuditPage({ server }: { server: Server }) {
  const [fixed, setFixed] = useState<string[]>([]);
  const [filter, setFilter] = useState<Severity | 'all'>('all');
  const score = Math.min(100, server.healthScore + auditFindings.filter((f) => fixed.includes(f.id)).reduce((s, f) => s + f.impact, 0));
  const list = auditFindings.filter((f) => filter === 'all' || f.severity === filter);
  const fixAll = () => setFixed(auditFindings.filter((f) => f.severity !== 'upgrade').map((f) => f.id));

  return (
    <>
      <PageHead title="Health Audit" subtitle="Security, permissions, structure and feature upgrades — checked automatically."
        action={<button className={`${styles.btn} ${styles.btnGreen}`} onClick={fixAll}>Fix all issues</button>} />
      <div className={styles.grid2}>
        <div className={styles.card}>
          <div className={styles.tabs}>
            {(['all', 'critical', 'warning', 'upgrade'] as const).map((s) => (
              <button key={s} className={`${styles.btn} ${styles.btnSmall} ${filter === s ? '' : styles.btnGhost}`} onClick={() => setFilter(s)}>{s}</button>
            ))}
          </div>
          {list.map((f) => {
            const done = fixed.includes(f.id);
            return (
              <div key={f.id} className={styles.row} style={{ opacity: done ? 0.55 : 1 }}>
                <span className={`${styles.pill} ${done ? styles.ok : styles[f.severity]}`}>{done ? 'fixed' : f.severity}</span>
                <div className={styles.grow}>
                  <strong>{f.title}</strong>
                  <div className={styles.muted}>{f.detail}</div>
                  <div className={styles.muted} style={{ color: '#9aa3ff' }}>→ {f.fix}</div>
                </div>
                {!done && <button className={`${styles.btn} ${styles.btnSmall}`} onClick={() => setFixed([...fixed, f.id])}>{f.severity === 'upgrade' ? 'Enable' : 'Fix'}</button>}
              </div>
            );
          })}
        </div>
        <div className={styles.card} style={{ textAlign: 'center', alignSelf: 'start' }}>
          <h3>Health score</h3>
          <HealthRing score={score} />
          <p className={styles.muted}>{fixed.length} of {auditFindings.length} resolved</p>
          <p className={styles.muted}>Last scan: just now · Next scheduled: daily 09:00</p>
        </div>
      </div>
    </>
  );
}
