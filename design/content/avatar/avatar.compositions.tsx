import React from 'react';
import { MockProvider } from '@chaotic-minds/guildpilot.testing.mock-provider';
import { Avatar } from './avatar.js';
import styles from './avatar.compositions.module.scss';

const USER_IMAGE = `https://storage.googleapis.com/bit-generated-images/images/image_stylized_portrait_avatar_of_a__0_1793290603011.png`;
const SERVER_IMAGE = `https://storage.googleapis.com/bit-generated-images/images/image_gaming_community_server_icon___0_1793290598539.png`;

export const ImageAndInitials = () => (
  <MockProvider>
    <div className={styles.panel}>
      <Avatar src={USER_IMAGE} name="Nova Cat" size="lg" />
      <Avatar name="Mira Solano" size="lg" />
      <Avatar name="Orion" size="lg" />
      <Avatar name="Kai Tanaka" size="lg" />
      <Avatar name="Zed" size="lg" />
    </div>
  </MockProvider>
);

export const Sizes = () => (
  <MockProvider>
    <div className={styles.panel}>
      <Avatar src={USER_IMAGE} name="Nova Cat" size="xs" />
      <Avatar src={USER_IMAGE} name="Nova Cat" size="sm" />
      <Avatar src={USER_IMAGE} name="Nova Cat" size="md" />
      <Avatar src={USER_IMAGE} name="Nova Cat" size="lg" />
      <Avatar src={USER_IMAGE} name="Nova Cat" size="xl" />
    </div>
  </MockProvider>
);

export const ServerIcons = () => (
  <MockProvider>
    <div className={styles.panel}>
      <Avatar src={SERVER_IMAGE} name="GuildPilot HQ" shape="square" size="xl" />
      <Avatar src={SERVER_IMAGE} name="GuildPilot HQ" shape="square" size="md" />
      <Avatar name="Pixel Pirates" shape="square" size="xl" />
      <Avatar name="Night Owls" shape="square" size="md" />
    </div>
  </MockProvider>
);

export const WithStatus = () => (
  <MockProvider>
    <div className={styles.panel}>
      <Avatar src={USER_IMAGE} name="Nova Cat" size="lg" status="online" />
      <Avatar name="Mira Solano" size="lg" status="idle" />
      <Avatar name="Kai Tanaka" size="lg" status="dnd" />
      <Avatar name="Orion" size="lg" status="offline" />
      <Avatar src={SERVER_IMAGE} name="GuildPilot HQ" shape="square" size="lg" status="online" />
    </div>
  </MockProvider>
);
