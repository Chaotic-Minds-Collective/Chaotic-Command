import { useState } from 'react';
import { tickets as initial, type Ticket, type TicketStatus } from './mock-data.js';
import { PageHead } from './layout.js';
import styles from './app.module.css';

/**
 * Ticket desk — triage, reply to, assign and close member tickets.
 */
export function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>(initial);
  const [activeId, setActiveId] = useState(initial[0].id);
  const [tab, setTab] = useState<TicketStatus | 'all'>('all');
  const [reply, setReply] = useState('');
  const active = tickets.find((t) => t.id === activeId)!;
  const list = tickets.filter((t) => tab === 'all' || t.status === tab);

  const update = (patch: Partial<Ticket>) => setTickets((ts) => ts.map((t) => (t.id === activeId ? { ...t, ...patch } : t)));
  const send = () => {
    if (!reply.trim()) return;
    update({ messages: [...active.messages, { from: 'Danielle', text: reply, staff: true }], status: 'pending', assignee: active.assignee ?? 'Danielle' });
    setReply('');
  };

  return (
    <>
      <PageHead title="Tickets" subtitle="Members open tickets with /ticket or the panel in #open-a-ticket." action={<button className={`${styles.btn} ${styles.btnGhost}`}>Edit ticket panel</button>} />
      <div className={styles.ticketLayout}>
        <div className={styles.card}>
          <div className={styles.tabs}>
            {(['all', 'open', 'pending', 'closed'] as const).map((s) => (
              <button key={s} className={`${styles.btn} ${styles.btnSmall} ${tab === s ? '' : styles.btnGhost}`} onClick={() => setTab(s)}>{s}</button>
            ))}
          </div>
          {list.map((t) => (
            <div key={t.id} className={`${styles.ticketItem} ${t.id === activeId ? styles.ticketActive : ''}`} onClick={() => setActiveId(t.id)}>
              <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                <span className={styles.muted}>{t.id}</span>
                <span className={`${styles.pill} ${styles[t.status]}`}>{t.status}</span>
                <span className={`${styles.pill} ${styles[t.priority]}`}>{t.priority}</span>
              </div>
              <div style={{ marginTop: '.3rem', fontWeight: 600 }}>{t.subject}</div>
              <div className={styles.muted}>{t.user} · {t.category} · {t.createdAt}</div>
            </div>
          ))}
        </div>
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className={styles.row} style={{ paddingTop: 0 }}>
            <div className={styles.grow}><strong>{active.subject}</strong><div className={styles.muted}>{active.id} · {active.user} · Assigned to {active.assignee ?? 'nobody'}</div></div>
            {!active.assignee && <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`} onClick={() => update({ assignee: 'Danielle' })}>Claim</button>}
            {active.status !== 'closed'
              ? <button className={`${styles.btn} ${styles.btnGreen} ${styles.btnSmall}`} onClick={() => update({ status: 'closed' })}>Close & save transcript</button>
              : <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`} onClick={() => update({ status: 'open' })}>Reopen</button>}
          </div>
          <div style={{ flex: 1, padding: '1rem 0', minHeight: 200 }}>
            {active.messages.map((m, i) => (
              <div key={i} className={`${styles.msg} ${m.staff ? styles.msgStaff : ''}`}>
                <div className={styles.muted}>{m.from}{m.staff ? ' · staff' : ''}</div>{m.text}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <input className={styles.input} placeholder="Reply to member…" value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
            <button className={styles.btn} onClick={send}>Send</button>
          </div>
        </div>
      </div>
    </>
  );
}
