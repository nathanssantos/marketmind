import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AboutTab } from './AboutTab';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, string>) => {
            if (key === 'about.version') return `Version ${options?.version ?? '0.0.0'}`;
            if (key === 'about.techStackList.electron') return `Electron ${options?.version ?? ''}`;
            if (key === 'about.techStackList.react') return `React ${options?.version ?? ''}`;
            if (key === 'about.techStackList.typescript') return `TypeScript ${options?.version ?? ''}`;
            if (key === 'about.techStackList.chakra') return `Chakra UI ${options?.version ?? ''}`;
            if (key === 'about.techStackList.vite') return `Vite ${options?.version ?? ''}`;
            if (key === 'about.techStackList.zustand') return `Zustand ${options?.version ?? ''}`;
            return key;
        },
    }),
}));

vi.mock('@/renderer/components/ui/logo', () => ({
    Logo: ({ size }: { size: number }) => <div data-testid="logo" data-size={size}>Logo</div>,
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

        expect(screen.getByText(/Version/)).toBeDefined();
        expect(screen.getByText(/0\.23\.0/)).toBeDefined();
    });

    it('renders app description', () => {
        renderWithChakra(<AboutTab />);

        expect(screen.getByText('about.description')).toBeDefined();
    });

    it('renders features section', () => {
        renderWithChakra(<AboutTab />);

        expect(screen.getByText('about.features')).toBeDefined();
        expect(screen.getByText(/about\.featuresList\.marketData/)).toBeDefined();
        expect(screen.getByText(/about\.featuresList\.charts/)).toBeDefined();
        expect(screen.getByText(/about\.featuresList\.aiAnalysis/)).toBeDefined();
    });

    it('renders all feature items', () => {
        renderWithChakra(<AboutTab />);

        const features = [
            'marketData', 'charts', 'aiAnalysis', 'news', 'chat',
            'security', 'autoUpdate', 'shortcuts', 'themes', 'websocket'
        ];

        features.forEach(feature => {
            expect(screen.getByText(new RegExp(`about\.featuresList\.${feature}`))).toBeDefined();
        });
    });

    it('renders tech stack section', () => {
        renderWithChakra(<AboutTab />);

        expect(screen.getByText('about.techStack')).toBeDefined();
    });

    it('displays tech stack with versions', () => {
        renderWithChakra(<AboutTab />);

        expect(screen.getByText(/Electron 39\.2\.0/)).toBeDefined();
        expect(screen.getByText(/React 19\.2\.0/)).toBeDefined();
        expect(screen.getByText(/TypeScript 5\.9\.3/)).toBeDefined();
        expect(screen.getByText(/Chakra UI 3\.29\.0/)).toBeDefined();
        expect(screen.getByText(/Vite 7\.2\.2/)).toBeDefined();
        expect(screen.getByText(/Zustand 5\.0\.8/)).toBeDefined();
    });

    it('renders resources section with links', () => {
        renderWithChakra(<AboutTab />);

        expect(screen.getByText('about.resources')).toBeDefined();

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
        expect(docsLink.getAttribute('href')).toContain('AI_CONTEXT.md');
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

        expect(screen.getByText('about.copyright')).toBeDefined();
    });

    it('logo has correct size', () => {
        renderWithChakra(<AboutTab />);

        const logo = screen.getByTestId('logo');
        expect(logo.getAttribute('data-size')).toBe('32');
    });
});
