/**
* This env uses bitdev.react/react-env, inspect it's config and API - https://bit.cloud/bitdev/react/react-env
* Learn more on how you can customize your env here - https://bit.dev/docs/react-env/set-up-your-env
*/
import { ReactEnv } from '@bitdev/react.react-env';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export class GuildpilotEnv extends ReactEnv {

  /* a shorthand name for the env */
  name = 'guildpilot-env';

  /* Typescript config. Learn how to replace compiler - https://bit.dev/reference/compiling/set-up-compiler */
  protected tsconfigPath = require.resolve('./config/tsconfig.json');

  protected tsTypesPath = './types';

  protected strict = false;

  /* OxLint config. Learn how to replace linter - https://bit.dev/reference/linting/set-up-linter */
  protected oxlintConfigPath = require.resolve('./config/oxlintrc.json');

  /* Prettier config. Learn how to replace formatter - https://bit.dev/reference/formatting/set-up-formatter */
  protected prettierConfigPath = require.resolve('./config/prettier.config.cjs');

  /* Vitest config. Learn how to replace tester - https://bit.dev/reference/testing/set-up-tester */
  protected vitestConfigPath = require.resolve('./config/vitest.config.mjs');

  /* component mounting and dev-server config. Learn how to replace dev-server - https://bit.dev/reference/preview/setup-preview */
  protected previewMounter = require.resolve('./preview/mounter.js');

  protected previewViteConfig = require.resolve('./config/vite.config.mjs')

  protected dirName = dirname(fileURLToPath(import.meta.url));
}

export default new GuildpilotEnv();
