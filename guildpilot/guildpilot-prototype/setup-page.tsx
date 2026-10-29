import { useState } from 'react';
import { templates } from './mock-data.js';
import { PageHead } from './layout.js';
import styles from './app.module.css';

/**
 * Server setup wizard — choose a template and preview the proposed structure before connecting Discord.
 */
export function SetupPage() {
  const [selected, setSelected] = useState(templates[0].id);
  const [progress, setProgress] = useState<number | null>(null);
  const tpl = templates.find((t) => t.id === selected)!;

  const deploy = () => {
    setProgress(0);
    const id = setInterval(() => {
      setProgress((p) => {
        if (p === null || p >= 100) { clearInterval(id); return 100; }
        return p + 10;
      });
    }, 180);
  };

  return (
    <>
      <PageHead title="Server Setup" subtitle="Preview a server structure before connecting Discord and applying changes." />
      <div className={styles.grid}>
        {templates.map((t) => (
          <div key={t.id} role="button" tabIndex={0} onClick={() => { setSelected(t.id); setProgress(null); }}
            className={`${styles.card} ${styles.templateCard} ${t.id === selected ? styles.selected : ''}`}>
            <div className={styles.emoji}>{t.emoji}</div>
            <h3 style={{ margin: '.5rem 0 .3rem' }}>{t.name}</h3>
            <div className={styles.muted}>{t.description}</div>
          </div>
        ))}
      </div>
      <div className={styles.grid2} style={{ marginTop: '1rem' }}>
        <div className={styles.card}>
          <h3>Channel structure preview</h3>
          <div className={styles.channelTree}>
            {tpl.channels.map((c) => (
              <div key={c.category}>
                <div className={styles.channelCat}>▾ {c.category}</div>
                {c.items.map((i) => <div key={i} style={{ paddingLeft: '1rem' }}>{i}</div>)}
              </div>
            ))}
          </div>
        </div>
        <div className={styles.card}>
          <h3>Roles</h3>
          <div className={styles.chips}>{tpl.roles.map((r) => <span key={r} className={styles.chip}>@{r}</span>)}</div>
          <h3 style={{ marginTop: '1.2rem' }}>Included systems</h3>
          <div className={styles.chips}>{tpl.features.map((f) => <span key={f} className={styles.chip}>✓ {f}</span>)}</div>
          <div style={{ marginTop: '1.5rem' }}>
            {progress === null && <button className={styles.btn} onClick={deploy}>Preview setup</button>}
            {progress !== null && (
              <>
                <div className={styles.progress}><div className={styles.progressBar} style={{ width: `${progress}%` }} /></div>
                <p className={styles.muted}>{progress < 100 ? `Simulating a setup preview… ${progress}%` : 'Preview complete. No changes have been made to Discord.'}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
