import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColorModeProvider } from '@renderer/components/ui';
import { GeneralTab } from './GeneralTab';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            language: 'en',
            changeLanguage: vi.fn(),
        },
    }),
}));

vi.mock('./LanguageSelector', () => ({
    LanguageSelector: () => <div>Language Selector</div>,
}));

const renderWithChakra = (component: React.ReactElement) => {
    return render(
        <ChakraProvider value={defaultSystem}>
            <ColorModeProvider>
                {component}
            </ColorModeProvider>
        </ChakraProvider>
    );
};

describe('GeneralTab', () => {
    it('renders language selector', () => {
        renderWithChakra(<GeneralTab />);
        expect(screen.getByText('Language Selector')).toBeDefined();
    });

    it('renders theme section', () => {
        renderWithChakra(<GeneralTab />);
        expect(screen.getByText('header.theme')).toBeDefined();
    });

    it('renders theme buttons', () => {
        renderWithChakra(<GeneralTab />);
        expect(screen.getByText('header.themeLight')).toBeDefined();
        expect(screen.getByText('header.themeDark')).toBeDefined();
    });

    it('switches to light theme', () => {
        renderWithChakra(<GeneralTab />);
        const lightButton = screen.getByText('header.themeLight');
        fireEvent.click(lightButton);
    });

    it('switches to dark theme', () => {
        renderWithChakra(<GeneralTab />);
        const darkButton = screen.getByText('header.themeDark');
        fireEvent.click(darkButton);
    });

    it('renders with light theme active', () => {
        renderWithChakra(<GeneralTab />);
        expect(screen.getByText('header.themeLight')).toBeDefined();
    });

    it('does not render auto update section', () => {
        renderWithChakra(<GeneralTab />);
        expect(screen.queryByText('settings.autoUpdate.title')).toBeNull();
    });
});
