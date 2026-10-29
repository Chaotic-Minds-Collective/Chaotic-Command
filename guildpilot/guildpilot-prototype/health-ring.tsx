import styles from './app.module.css';

/**
 * Circular server health score indicator.
 * @param props.score - Score from 0 to 100.
 */
export function HealthRing({ score }: { score: number }) {
  const r = 60;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? '#3BD6A0' : score >= 60 ? '#F5A524' : '#ED4245';
  const label = score >= 80 ? 'Healthy' : score >= 60 ? 'Needs work' : 'At risk';
  return (
    <div className={styles.ring}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} stroke="#2a2f40" strokeWidth="12" fill="none" />
        <circle cx="70" cy="70" r={r} stroke={color} strokeWidth="12" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (score / 100) * c} transform="rotate(-90 70 70)" style={{ transition: 'stroke-dashoffset .6s' }} />
      </svg>
      <div className={styles.ringLabel}><div><strong>{score}</strong><span style={{ color, fontSize: '.85rem' }}>{label}</span></div></div>
    </div>
  );
}
