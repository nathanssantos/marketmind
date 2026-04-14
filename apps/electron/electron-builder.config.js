export default {
    appId: 'com.nathanssantos.marketmind',
    productName: 'MarketMind',
    copyright: 'Copyright © 2025 Nathan Santos',

    publish: {
        provider: 'github',
        owner: 'nathanssantos',
        repo: 'marketmind',
    },

    directories: {
        output: 'dist',
        buildResources: 'build',
    },

    artifactName: '${productName}-${version}-${arch}.${ext}',

    files: [
        'dist/**/*',
        'dist-electron/**/*',
        'package.json',
    ],

    extraMetadata: {
        main: 'dist-electron/main/index.js',
        name: 'marketmind',
    },

    mac: {
        target: ['dmg', 'zip'],
        category: 'public.app-category.finance',
        icon: 'build/icon.icns',
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
    },
};
