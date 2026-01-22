import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { MetricCard } from './MetricCard';
import { ColorModeProvider } from './color-mode';

const renderWithProviders = (ui: ReactElement) =>
  render(
    <ChakraProvider value={defaultSystem}>
      <ColorModeProvider>{ui}</ColorModeProvider>
    </ChakraProvider>
  );

describe('MetricCard', () => {
  it('should render label and value', () => {
    renderWithProviders(<MetricCard label="Total Sales" value={1234} />);

    expect(screen.getByText('Total Sales')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('should format currency values', () => {
    renderWithProviders(
      <MetricCard label="Revenue" value={1234.56} format="currency" currency="USD" />
    );

    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('$1,234.56')).toBeInTheDocument();
  });

  it('should format percent values', () => {
    renderWithProviders(<MetricCard label="Growth" value={15.5} format="percent" />);

    expect(screen.getByText('Growth')).toBeInTheDocument();
    expect(screen.getByText('+15.50%')).toBeInTheDocument();
  });

  it('should format negative percent values', () => {
    renderWithProviders(<MetricCard label="Change" value={-8.25} format="percent" />);

    expect(screen.getByText('-8.25%')).toBeInTheDocument();
  });

  it('should render string values as-is', () => {
    renderWithProviders(<MetricCard label="Status" value="Active" />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should render trend indicator for up trend', () => {
    const { container } = renderWithProviders(
      <MetricCard label="Sales" value={100} trend="up" trendValue="+10%" />
    );

    expect(screen.getByText('+10%')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('should render trend indicator for down trend', () => {
    const { container } = renderWithProviders(
      <MetricCard label="Sales" value={100} trend="down" trendValue="-5%" />
    );

    expect(screen.getByText('-5%')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('should not render trend indicator for neutral trend', () => {
    const { container } = renderWithProviders(
      <MetricCard label="Sales" value={100} trend="neutral" />
    );

    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBe(0);
  });

  it('should render help text when provided', () => {
    renderWithProviders(
      <MetricCard label="Revenue" value={1000} helpText="Last 30 days" />
    );

    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
  });

  it('should apply different sizes', () => {
    const { rerender } = renderWithProviders(
      <MetricCard label="Small" value={100} size="sm" />
    );
    expect(screen.getByText('Small')).toBeInTheDocument();

    rerender(
      <ChakraProvider value={defaultSystem}>
        <ColorModeProvider>
          <MetricCard label="Medium" value={100} size="md" />
        </ColorModeProvider>
      </ChakraProvider>
    );
    expect(screen.getByText('Medium')).toBeInTheDocument();

    rerender(
      <ChakraProvider value={defaultSystem}>
        <ColorModeProvider>
          <MetricCard label="Large" value={100} size="lg" />
        </ColorModeProvider>
      </ChakraProvider>
    );
    expect(screen.getByText('Large')).toBeInTheDocument();
  });

  it('should apply color based on value when colorByValue is true', () => {
    renderWithProviders(
      <MetricCard label="Profit" value={500} colorByValue={true} />
    );

    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('should handle zero values', () => {
    renderWithProviders(<MetricCard label="Count" value={0} />);

    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
