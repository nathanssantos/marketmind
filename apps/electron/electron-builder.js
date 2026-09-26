export default {
    appId: 'com.nathanssantos.marketmind',
    productName: 'MarketMind',
    copyright: 'Copyright © 2025 Nathan Santos',

    publish: {
        provider: 'github',
        owner: 'nathanssantos',
        repo: 'marketmind',
        releaseType: 'release',
    },

    directories: {
        output: 'release',
        buildResources: 'build',
    },

    artifactName: '${productName}-${version}-${arch}.${ext}',

    files: [
        'dist-electron/**/*',
        'package.json',
        '!node_modules/@embedded-postgres/**',
    ],

    extraResources: [
        { from: '../backend/dist-embedded', to: 'backend' },
        { from: 'dist', to: 'renderer' },
    ],

    extraMetadata: {
        main: 'dist-electron/main/index.js',
        name: 'marketmind',
    },

    mac: {
        target: ['dmg', 'zip'],
        category: 'public.app-category.finance',
        icon: 'build/icon.icns',
        extraResources: [{ from: 'node_modules/@embedded-postgres/darwin-${arch}/native', to: 'postgres' }],
    },
    
    dmg: {
        title: '${productName} ${version}',
        window: {
            width: 540,
            height: 380,
        },
    },
    
    win: {
        target: ['nsis'],
        icon: 'build/icon-256.png',
        extraResources: [{ from: 'node_modules/@embedded-postgres/windows-x64/native', to: 'postgres' }],
    },
    
    nsis: {
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
    },
    
    linux: {
        target: ['AppImage'],
        category: 'Finance',
        icon: 'build/icon.png',
        extraResources: [{ from: 'node_modules/@embedded-postgres/linux-${arch}/native', to: 'postgres' }],
    },
};
