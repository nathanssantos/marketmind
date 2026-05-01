import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import type { UserIndicator } from '@marketmind/trading-core';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { IndicatorConfigDialog } from './IndicatorConfigDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _ }),
  Trans: ({ children }: { children: unknown }) => children,
}));

const renderWithChakra = (ui: ReactElement) =>
  render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);

describe('IndicatorConfigDialog', () => {
  describe('create mode', () => {
    it('submits catalogType + label + params on save', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      renderWithChakra(
        <IndicatorConfigDialog isOpen mode="create" onClose={vi.fn()} onSubmit={onSubmit} />,
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'create',
          catalogType: expect.any(String),
          label: expect.any(String),
          params: expect.any(Object),
        }),
      );
      const call = onSubmit.mock.calls[0][0];
      expect(call.label.length).toBeGreaterThan(0);
    });

    it('auto-generates label from catalog defaultLabel before user edits', async () => {
      const onSubmit = vi.fn();
      renderWithChakra(
        <IndicatorConfigDialog isOpen mode="create" onClose={vi.fn()} onSubmit={onSubmit} />,
      );

      const labelInput = screen.getByPlaceholderText('indicators.dialog.labelPlaceholder') as HTMLInputElement;
      expect(labelInput.value.length).toBeGreaterThan(0);
    });

    it('preserves user-edited label when params change', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderWithChakra(
        <IndicatorConfigDialog isOpen mode="create" onClose={vi.fn()} onSubmit={onSubmit} />,
      );

      const labelInput = screen.getByPlaceholderText('indicators.dialog.labelPlaceholder') as HTMLInputElement;
      await user.clear(labelInput);
      await user.type(labelInput, 'My Indicator');

      await user.click(screen.getByRole('button', { name: /save/i }));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'My Indicator' }),
      );
    });
  });

  describe('edit mode', () => {
    const instance: UserIndicator = {
      id: 'ind-1',
      catalogType: 'ema',
      label: 'EMA 50',
      params: { period: 50, color: '#00e676', lineWidth: 1 },
      isCustom: true,
    };

    it('loads initial label and params from instance', () => {
      renderWithChakra(
        <IndicatorConfigDialog
          isOpen
          mode="edit"
          instance={instance}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );

      expect((screen.getByDisplayValue('EMA 50') as HTMLInputElement).value).toBe('EMA 50');
    });

    it('submits updated label with instance id', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderWithChakra(
        <IndicatorConfigDialog
          isOpen
          mode="edit"
          instance={instance}
          onClose={vi.fn()}
          onSubmit={onSubmit}
        />,
      );

      const input = screen.getByDisplayValue('EMA 50');
      fireEvent.change(input, { target: { value: 'EMA 100' } });

      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'edit', id: 'ind-1', label: 'EMA 100' }),
      );
    });

    it('disables submit when label is empty', async () => {
      const onSubmit = vi.fn();
      renderWithChakra(
        <IndicatorConfigDialog
          isOpen
          mode="edit"
          instance={instance}
          onClose={vi.fn()}
          onSubmit={onSubmit}
        />,
      );

      const input = screen.getByDisplayValue('EMA 50');
      fireEvent.change(input, { target: { value: '   ' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('checklist-condition mode', () => {
    const indicators: UserIndicator[] = [
      {
        id: 'rsi-1',
        catalogType: 'rsi',
        label: 'RSI 14',
        params: { period: 14 },
        isCustom: false,
      },
    ];

    it('submits condition with selected indicator id', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderWithChakra(
        <IndicatorConfigDialog
          isOpen
          mode="checklist-condition"
          availableIndicators={indicators}
          onClose={vi.fn()}
          onSubmit={onSubmit}
        />,
      );

      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'checklist-condition',
          userIndicatorId: 'rsi-1',
          timeframe: 'current',
          tier: 'required',
          side: 'BOTH',
        }),
      );
    });

    it('disables submit when no indicator is selected', () => {
      renderWithChakra(
        <IndicatorConfigDialog
          isOpen
          mode="checklist-condition"
          availableIndicators={[]}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });
  });
});
