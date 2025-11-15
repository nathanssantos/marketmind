/**
 * @see https://www.electron.build/configuration/configuration
 */
export default {
  appId: 'com.marketmind.app',
  productName: 'MarketMind',
  directories: {
    output: 'dist-electron',
    buildResources: 'build',
  },
  files: ['dist/**/*', 'dist-electron/**/*', 'package.json'],
  mac: {
    target: ['dmg', 'zip'],
    category: 'public.app-category.finance',
    icon: 'build/icon.icns',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
  },
  win: {
    target: ['nsis', 'portable'],
    icon: 'build/icon.ico',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Finance',
    icon: 'build/icon.png',
  },
  publish: {
    provider: 'github',
    owner: 'nathanssantos',
    repo: 'marketmind',
  },
};
