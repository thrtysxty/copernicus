import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {
    onlyModules: [], // Skip native rebuilds to bypass xcodebuild environment bugs
  },
  makers: [new MakerZIP({}, ['darwin'])],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'electron.vite.config.ts',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'electron.vite.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'electron.vite.config.ts',
        },
      ],
    }),
    new AutoUnpackNativesPlugin({}),
  ],
};

export default config;
