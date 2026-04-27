import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GlobalActionsProvider, useGlobalActions } from './GlobalActionsContext';

describe('GlobalActionsContext', () => {
  const TestComponent = () => {
    const actions = useGlobalActions();
    return (
      <div>
        <button onClick={actions.openSettings}>Open Settings</button>
        <button onClick={actions.openSymbolSelector}>Open Symbol</button>
      </div>
    );
  };

  const mockActions = {
    openSettings: vi.fn(),
    openSymbolSelector: vi.fn(),
    navigateToSymbol: vi.fn(),
    closeAll: vi.fn(),
    setTimeframe: vi.fn(),
    setChartType: vi.fn(),
    setMarketType: vi.fn(),
  };

  it('should provide actions to children', () => {
    render(
      <GlobalActionsProvider actions={mockActions}>
        <TestComponent />
      </GlobalActionsProvider>
    );

    expect(screen.getByText('Open Settings')).toBeTruthy();
    expect(screen.getByText('Open Symbol')).toBeTruthy();
  });

  it('should throw error when used outside provider', () => {
    const InvalidComponent = () => {
      useGlobalActions();
      return <div>Test</div>;
    };

    expect(() => {
      render(<InvalidComponent />);
    }).toThrow('useGlobalActions must be used within GlobalActionsProvider');
  });

  it('should call actions when buttons are clicked', () => {
    render(
      <GlobalActionsProvider actions={mockActions}>
        <TestComponent />
      </GlobalActionsProvider>
    );

    screen.getByText('Open Settings').click();
    expect(mockActions.openSettings).toHaveBeenCalled();

    screen.getByText('Open Symbol').click();
    expect(mockActions.openSymbolSelector).toHaveBeenCalled();
  });
});
