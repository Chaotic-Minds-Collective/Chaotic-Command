import React, { useState } from 'react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Card } from './card.js';
import styles from './card.compositions.module.scss';

export const BasicCard = () => {
  return (
    <MockProvider>
      <div className={styles.stage}>
        <Card title="Server health">
          <p className={styles.text}>All systems nominal. 3 open tickets and 0 active raids.</p>
        </Card>
      </div>
    </MockProvider>
  );
};

export const WithActions = () => {
  return (
    <MockProvider>
      <div className={styles.stage}>
        <Card
          title="Raid detected in #general"
          actions={
            <button type="button" className={styles.button}>
              Lock channel
            </button>
          }
        >
          <p className={styles.text}>12 new accounts joined in 30 seconds.</p>
        </Card>
      </div>
    </MockProvider>
  );
};

const templates = [
  { id: `gaming`, title: `Gaming community`, description: `Channels for LFG, clips and voice lobbies.` },
  { id: `support`, title: `Support hub`, description: `Ticket intake, FAQ and staff channels.` },
  { id: `creator`, title: `Creator space`, description: `Announcements, showcase and Q&A.` },
];

export const SelectableCards = () => {
  const [selectedId, setSelectedId] = useState(`gaming`);

  return (
    <MockProvider>
      <div className={styles.grid}>
        {templates.map((template) => (
          <Card
            key={template.id}
            title={template.title}
            selectable
            selected={selectedId === template.id}
            onSelect={() => setSelectedId(template.id)}
          >
            <p className={styles.text}>{template.description}</p>
          </Card>
        ))}
      </div>
    </MockProvider>
  );
};

export const PaddingSizes = () => {
  return (
    <MockProvider>
      <div className={styles.grid}>
        <Card padding="none" interactive>
          <p className={styles.text}>None</p>
        </Card>
        <Card padding="small" interactive>
          <p className={styles.text}>Small</p>
        </Card>
        <Card padding="medium" interactive>
          <p className={styles.text}>Medium</p>
        </Card>
        <Card padding="large" interactive>
          <p className={styles.text}>Large</p>
        </Card>
      </div>
    </MockProvider>
  );
};
