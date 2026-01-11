import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CryptoIcon } from './CryptoIcon';

const renderWithProviders = (ui: React.ReactElement) => {
    return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
};

describe('CryptoIcon', () => {
    it('should render an image for valid symbol', () => {
        renderWithProviders(<CryptoIcon symbol="BTCUSDT" />);
        const img = screen.getByRole('img', { name: /btcusdt icon/i });
        expect(img).toBeInTheDocument();
    });

    it('should extract base asset correctly from symbol', () => {
        renderWithProviders(<CryptoIcon symbol="ETHUSDT" />);
        const img = screen.getByRole('img', { name: /ethusdt icon/i });
        expect(img).toHaveAttribute('src', expect.stringContaining('eth'));
    });

    it('should handle different quote assets', () => {
        renderWithProviders(<CryptoIcon symbol="BTCBUSD" />);
        const img = screen.getByRole('img', { name: /btcbusd icon/i });
        expect(img).toHaveAttribute('src', expect.stringContaining('btc'));
    });

    it('should apply custom size', () => {
        renderWithProviders(<CryptoIcon symbol="BTCUSDT" size={24} />);
        const img = screen.getByRole('img', { name: /btcusdt icon/i });
        expect(img).toHaveStyle({ width: '24px', height: '24px' });
    });

    it('should use default size of 16px when not specified', () => {
        renderWithProviders(<CryptoIcon symbol="BTCUSDT" />);
        const img = screen.getByRole('img', { name: /btcusdt icon/i });
        expect(img).toHaveStyle({ width: '16px', height: '16px' });
    });

    it('should call onClick when clicked', () => {
        const handleClick = vi.fn();
        renderWithProviders(<CryptoIcon symbol="BTCUSDT" onClick={handleClick} cursor="pointer" />);
        const img = screen.getByRole('img', { name: /btcusdt icon/i });
        fireEvent.click(img);
        expect(handleClick).toHaveBeenCalledOnce();
    });

    it('should apply cursor style', () => {
        renderWithProviders(<CryptoIcon symbol="BTCUSDT" cursor="pointer" />);
        const img = screen.getByRole('img', { name: /btcusdt icon/i });
        expect(img).toBeInTheDocument();
        expect(img).toHaveStyle({ cursor: 'pointer' });
    });

    it('should handle unknown symbols with fallback on error', () => {
        renderWithProviders(<CryptoIcon symbol="UNKNOWNCOIN123" />);
        const img = screen.getByRole('img', { name: /unknowncoin123 icon/i });
        expect(img).toBeInTheDocument();
    });

    it('should extract base asset from FDUSD pairs', () => {
        renderWithProviders(<CryptoIcon symbol="BTCFDUSD" />);
        const img = screen.getByRole('img', { name: /btcfdusd icon/i });
        expect(img).toHaveAttribute('src', expect.stringContaining('btc'));
    });

    it('should extract base asset from BTC pairs', () => {
        renderWithProviders(<CryptoIcon symbol="ETHBTC" />);
        const img = screen.getByRole('img', { name: /ethbtc icon/i });
        expect(img).toHaveAttribute('src', expect.stringContaining('eth'));
    });

    it('should use lowercase for asset in URL', () => {
        renderWithProviders(<CryptoIcon symbol="SOLUSDT" />);
        const img = screen.getByRole('img', { name: /solusdt icon/i });
        expect(img).toHaveAttribute('src', expect.stringContaining('sol'));
        expect(img).toHaveAttribute('src', expect.not.stringContaining('SOL'));
    });
});
