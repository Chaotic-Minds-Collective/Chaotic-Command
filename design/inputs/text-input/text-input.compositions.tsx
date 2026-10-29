import React, { useState } from 'react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { TextInput } from './text-input.js';
import styles from './text-input.compositions.module.scss';

export const Basic = () => {
  const [value, setValue] = useState(``);

  return (
    <MockProvider>
      <div className={styles.stack}>
        <TextInput
          label="Server name"
          hint="This is how your guild appears in the dashboard."
          placeholder="e.g. Chaotic Minds"
          value={value}
          onChange={(next) => setValue(next)}
        />
      </div>
    </MockProvider>
  );
};

export const WithErrorAndAffixes = () => {
  return (
    <MockProvider>
      <div className={styles.stack}>
        <TextInput
          label="Log channel"
          prefix="#"
          defaultValue="mod log"
          error="Channel names cannot contain spaces."
          required
        />
        <TextInput label="Invite link" prefix="discord.gg/" suffix=".com" defaultValue="guildpilot" />
      </div>
    </MockProvider>
  );
};

export const Sizes = () => {
  return (
    <MockProvider>
      <div className={styles.stack}>
        <TextInput size="small" label="Small" placeholder="Small input" />
        <TextInput size="medium" label="Medium" placeholder="Medium input" />
        <TextInput size="large" label="Large" placeholder="Large input" />
        <TextInput label="Disabled" placeholder="Not editable" disabled />
      </div>
    </MockProvider>
  );
};
