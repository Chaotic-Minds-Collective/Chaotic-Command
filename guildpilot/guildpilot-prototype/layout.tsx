import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { servers, tickets } from './mock-data.js';
import styles from './app.module.css';

const navItems = [
  { to: '/', label: 'Overview', icon: '📊' },
  { to: '/setup', label: 'Server Setup', icon: '🧱' },
  { to: '/audit', label: 'Health Audit', icon: '🩺' },
  { to: '/tickets', label: 'Tickets', icon: '🎫', badge: true },
  { to: '/moderation', label: 'Moderation', icon: '🛡️' },
  { to: '/settings', label: 'Roles & Settings', icon: '⚙️' },
];

/**
 * App shell with sidebar navigation and server picker.
 * @param props.children - Page content.
 * @param props.serverId - Currently selected server.
 * @param props.onServerChange - Called when the user switches server.
 */
export function Layout({ children, serverId, onServerChange }: { children: ReactNode; serverId: string; onServerChange: (id: string) => void }) {
  const openCount = tickets.filter((t) => t.status === 'open').length;
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}><span className={styles.logo}>▲</span>GuildPilot</div>
        <select className={styles.serverPicker} value={serverId} onChange={(e) => onServerChange(e.target.value)} aria-label="Select server">
          {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <nav className={styles.nav}>
          {navItems.map((n) => (
            <NavLink key={n.to} to={n.to} end className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
              <span>{n.icon}</span>{n.label}
              {n.badge && openCount > 0 && <span className={styles.badge}>{openCount}</span>}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sideFooter}>Discord connection: <span style={{ color: '#E5B45C' }}>● Not connected</span></div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

/**
 * Standard page header.
 * @param props.title - Page title.
 * @param props.subtitle - Short description.
 * @param props.action - Optional action element on the right.
 */
export function PageHead({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className={styles.pageHead}>
      <div><h1>{title}</h1><p>{subtitle}</p></div>
      {action}
    </div>
  );
}
