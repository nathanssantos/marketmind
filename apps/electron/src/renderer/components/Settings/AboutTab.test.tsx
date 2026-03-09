import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { APP_VERSION } from '../../../shared/constants';
import { AboutTab } from './AboutTab';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, string | number>) => {
            if (key === 'about.version') return `Version ${options?.version ?? '0.0.0'}`;
            if (key === 'about.copyright') return `© ${options?.year ?? 2024} MarketMind`;
            return key;
        },
    }),
}));

vi.mock('@/renderer/components/ui/logo', () => ({
    Logo: ({ size }: { size: number }) => <div data-testid="logo" data-size={size}>Logo</div>,
}));

vi.mock('@/renderer/store/preferencesStore', () => ({
    useUIPref: (_key: string, defaultValue: unknown) => [defaultValue, vi.fn()],
}));

vi.mock('@/renderer/hooks/useAutoUpdate', () => ({
    useAutoUpdate: () => ({
        status: 'idle',
        updateInfo: null,
        progress: null,
        error: null,
        currentVersion: '0.0.0',
        checkForUpdates: vi.fn(),
        downloadUpdate: vi.fn(),
        installUpdate: vi.fn(),
        startAutoCheck: vi.fn(),
        stopAutoCheck: vi.fn(),
    }),
}));

vi.mock('@/renderer/hooks/useDebounceCallback', () => ({
    useDebounceCallback: (fn: () => void) => fn,
}));

vi.mock('@/renderer/constants/defaults', () => ({
    DEFAULT_AUTO_UPDATE_SETTINGS: {
        autoCheckUpdates: false,
        autoDownloadUpdates: false,
        updateCheckInterval: 6,
    },
}));

const renderWithChakra = (component: React.ReactElement) => {
    return render(
        <ChakraProvider value={defaultSystem}>
            {component}
        </ChakraProvider>
    );
};

describe('AboutTab', () => {
    it('renders app title and logo', () => {
        renderWithChakra(<AboutTab />);

        expect(screen.getByTestId('logo')).toBeDefined();
        expect(screen.getByText('app.title')).toBeDefined();
    });

    it('displays app version', () => {
        renderWithChakra(<AboutTab />);

        expect(screen.getByText(`Version ${APP_VERSION}`)).toBeDefined();
    });

    it('renders app description', () => {
        renderWithChakra(<AboutTab />);

        expect(screen.getByText('about.description')).toBeDefined();
    });

    it('renders resources section', () => {
        renderWithChakra(<AboutTab />);

        expect(screen.getByText('about.resources')).toBeDefined();
    });

    it('renders resources section with links', () => {
        renderWithChakra(<AboutTab />);

        const links = screen.getAllByRole('link');
        expect(links.length).toBeGreaterThanOrEqual(3);
    });

    it('renders GitHub link', () => {
        renderWithChakra(<AboutTab />);

        const githubLink = screen.getByRole('link', { name: /github/i });
        expect(githubLink.getAttribute('href')).toBe('https://github.com/nathanssantos/marketmind');
        expect(githubLink.getAttribute('target')).toBe('_blank');
    });

    it('renders documentation link', () => {
        renderWithChakra(<AboutTab />);

        const docsLink = screen.getByRole('link', { name: /documentation/i });
        expect(docsLink.getAttribute('href')).toContain('copilot-instructions.md');
        expect(docsLink.getAttribute('target')).toBe('_blank');
    });

    it('renders changelog link', () => {
        renderWithChakra(<AboutTab />);

        const changelogLink = screen.getByRole('link', { name: /changelog/i });
        expect(changelogLink.getAttribute('href')).toContain('CHANGELOG.md');
        expect(changelogLink.getAttribute('target')).toBe('_blank');
    });

    it('renders copyright section', () => {
        renderWithChakra(<AboutTab />);

        const currentYear = new Date().getFullYear();
        expect(screen.getByText(`© ${currentYear} MarketMind`)).toBeDefined();
    });

    it('logo has correct size', () => {
        renderWithChakra(<AboutTab />);

        const logo = screen.getByTestId('logo');
        expect(logo.getAttribute('data-size')).toBe('32');
    });
});
