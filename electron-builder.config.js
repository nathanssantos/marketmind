export default {
    appId: 'com.nathanssantos.marketmind',
    productName: 'MarketMind',
    copyright: 'Copyright © 2025 Nathan Santos',
    
    directories: {
        output: 'dist',
        buildResources: 'build',
    },
    
    files: [
        'dist/**/*',
        'dist-electron/**/*',
        'package.json',
    ],
    
    extraMetadata: {
        main: 'dist-electron/main/index.js',
    },
    
    mac: {
        target: ['dmg'],
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
