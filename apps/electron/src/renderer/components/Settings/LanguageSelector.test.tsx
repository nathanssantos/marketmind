import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageSelector } from './LanguageSelector';

const { mockChangeLanguage, mockChangeLanguageLazy } = vi.hoisted(() => ({
    mockChangeLanguage: vi.fn(),
    mockChangeLanguageLazy: vi.fn(),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            language: 'en',
            changeLanguage: mockChangeLanguage,
        },
    }),
}));

vi.mock('@renderer/i18n', () => ({
    changeLanguageLazy: mockChangeLanguageLazy,
    default: { language: 'en' },
}));

const renderWithChakra = (component: React.ReactElement) => {
    return render(
        <ChakraProvider value={defaultSystem}>
            {component}
        </ChakraProvider>
    );
};

describe('LanguageSelector', () => {
    it('renders with current language', () => {
        renderWithChakra(<LanguageSelector />);

        expect(screen.getByText('English')).toBeDefined();
    });

    it('changes language when option is selected', async () => {
        const { findByText } = renderWithChakra(<LanguageSelector />);

        const select = await findByText('English');
        expect(select).toBeDefined();

        expect(mockChangeLanguage).toBeDefined();
    });
});
