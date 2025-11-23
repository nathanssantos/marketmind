import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageSelector } from './LanguageSelector';

const mockChangeLanguage = vi.fn();

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            language: 'en',
            changeLanguage: mockChangeLanguage,
        },
    }),
}));

const renderWithChakra = (component: React.ReactElement) => {
    return render(
        <ChakraProvider value={defaultSystem}>
            {component}
        </ChakraProvider>
    );
};

describe('LanguageSelector', () => {
    it('renders language selector title', () => {
        renderWithChakra(<LanguageSelector />);

        expect(screen.getByText('settings.language.title')).toBeDefined();
    });

    it('renders language selector description', () => {
        renderWithChakra(<LanguageSelector />);

        expect(screen.getByText('settings.language.description')).toBeDefined();
    });

    it('renders with current language', () => {
        renderWithChakra(<LanguageSelector />);

        expect(screen.getByText('English')).toBeDefined();
    });
});
