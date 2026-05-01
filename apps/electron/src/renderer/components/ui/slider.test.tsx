import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Slider } from '@marketmind/ui-core';

const renderWithChakra = (ui: ReactElement) => render(
    <ChakraProvider value={defaultSystem}>
        {ui}
    </ChakraProvider>
);

describe('Slider', () => {
    const defaultProps = {
        value: [50],
        onValueChange: vi.fn(),
        min: 0,
        max: 100,
        step: 1,
    };

    it('should render slider component', () => {
        const { container } = renderWithChakra(<Slider {...defaultProps} />);

        expect(container.firstChild).toBeInTheDocument();
    });

    it('should render with label when provided', () => {
        renderWithChakra(<Slider {...defaultProps} label="Volume" />);

        expect(screen.getByText('Volume')).toBeInTheDocument();
    });

    it('should not render label when not provided', () => {
        renderWithChakra(<Slider {...defaultProps} />);

        const label = screen.queryByText('Volume');
        expect(label).not.toBeInTheDocument();
    });

    it('should show value when showValue is true', () => {
        renderWithChakra(<Slider {...defaultProps} showValue />);

        expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('should not show value when showValue is false', () => {
        renderWithChakra(<Slider {...defaultProps} showValue={false} />);

        const valueText = screen.queryByText('50');
        expect(valueText).not.toBeInTheDocument();
    });

    it('should render with custom width', () => {
        const { container } = renderWithChakra(
            <Slider {...defaultProps} width="300px" />
        );

        expect(container.firstChild).toBeInTheDocument();
    });

    it('should render with different values', () => {
        const { rerender } = renderWithChakra(
            <Slider value={[25]} onValueChange={vi.fn()} min={0} max={100} step={1} showValue />
        );

        expect(screen.getByText('25')).toBeInTheDocument();

        rerender(
            <ChakraProvider value={defaultSystem}>
                <Slider value={[75]} onValueChange={vi.fn()} min={0} max={100} step={1} showValue />
            </ChakraProvider>
        );

        expect(screen.getByText('75')).toBeInTheDocument();
    });

    it('should render with label and value together', () => {
        renderWithChakra(
            <Slider {...defaultProps} label="Opacity" showValue value={[75]} />
        );

        expect(screen.getByText('Opacity')).toBeInTheDocument();
        expect(screen.getByText('75')).toBeInTheDocument();
    });

    it('should render with different step values', () => {
        const { container } = renderWithChakra(
            <Slider {...defaultProps} step={10} />
        );

        expect(container.firstChild).toBeInTheDocument();
    });

    it('should render with different min/max ranges', () => {
        const { container } = renderWithChakra(
            <Slider value={[25]} onValueChange={vi.fn()} min={0} max={50} step={5} />
        );

        expect(container.firstChild).toBeInTheDocument();
    });
});

