import { Link } from 'react-router-dom';
import { auditFindings, modActions, tickets, type Server } from './mock-data.js';
import { HealthRing } from './health-ring.js';
import { PageHead } from './layout.js';
import styles from './app.module.css';

/**
 * Dashboard overview of the selected server.
 * @param props.server - The selected server.
 */
export function OverviewPage({ server }: { server: Server }) {
  const open = tickets.filter((t) => t.status === 'open');
  const critical = auditFindings.filter((f) => f.severity === 'critical');
  return (
    <>
      <PageHead title={server.name} subtitle="Everything happening in your server at a glance." action={<Link to="/audit"><button className={styles.btn}>Run full audit</button></Link>} />
      <div className={styles.grid}>
        <div className={styles.card}><div className={styles.statLabel}>Members</div><div className={styles.statValue}>{server.members.toLocaleString()}</div><div className={styles.statSub}>+124 this week</div></div>
        <div className={styles.card}><div className={styles.statLabel}>Online now</div><div className={styles.statValue}>{server.online.toLocaleString()}</div><div className={styles.statSub}>{Math.round((server.online / server.members) * 100)}% active</div></div>
        <div className={styles.card}><div className={styles.statLabel}>Open tickets</div><div className={styles.statValue}>{open.length}</div><div className={styles.statSub}>Avg. response 6m</div></div>
        <div className={styles.card}><div className={styles.statLabel}>Boost level</div><div className={styles.statValue}>Tier {server.boostLevel}</div><div className={styles.statSub}>41 boosters</div></div>
      </div>
      <div className={styles.grid2} style={{ marginTop: '1rem' }}>
        <div className={styles.card}>
          <h3>Needs your attention</h3>
          {critical.map((f) => (
            <div key={f.id} className={styles.row}>
              <span className={`${styles.pill} ${styles.critical}`}>critical</span>
              <div className={styles.grow}>{f.title}<div className={styles.muted}>{f.category}</div></div>
              <Link to="/audit"><button className={`${styles.btn} ${styles.btnSmall}`}>Fix</button></Link>
            </div>
          ))}
          {open.map((t) => (
            <div key={t.id} className={styles.row}>
              <span className={`${styles.pill} ${styles.open}`}>ticket</span>
              <div className={styles.grow}>{t.subject}<div className={styles.muted}>{t.user} · {t.createdAt}</div></div>
              <Link to="/tickets"><button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`}>Open</button></Link>
            </div>
          ))}
        </div>
        <div className={styles.card} style={{ textAlign: 'center' }}>
          <h3>Server health</h3>
          <HealthRing score={server.healthScore} />
          <p className={styles.muted}>{auditFindings.length} findings · {critical.length} critical</p>
        </div>
      </div>
      <div className={styles.card} style={{ marginTop: '1rem' }}>
        <h3>Recent moderation</h3>
        {modActions.slice(0, 3).map((m) => (
          <div key={m.id} className={styles.row}>
            <strong style={{ width: 80 }}>{m.action}</strong>
            <div className={styles.grow}>{m.target}<div className={styles.muted}>{m.reason}</div></div>
            <span className={styles.muted}>{m.moderator} · {m.time}</span>
          </div>
        ))}
      </div>
    </>
  );
}
