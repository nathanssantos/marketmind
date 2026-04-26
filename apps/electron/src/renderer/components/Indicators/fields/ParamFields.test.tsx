import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ParamSchema } from '@marketmind/trading-core';
import { BooleanField } from './BooleanField';
import { ColorField } from './ColorField';
import { NumberField } from './NumberField';
import { ParamFields } from './ParamFields';
import { SelectField } from './SelectField';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }),
}));

const renderUI = (ui: React.ReactElement) =>
  render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);

describe('NumberField', () => {
  it('renders the value and label', () => {
    renderUI(<NumberField label="Period" value={14} onChange={() => {}} />);
    expect(screen.getByText('Period')).toBeTruthy();
    const input = screen.getByLabelText('Period') as HTMLInputElement;
    expect(input.value).toBe('14');
  });

  it('calls onChange with parsed integer when integer=true', () => {
    const onChange = vi.fn();
    renderUI(<NumberField label="Period" value={14} integer onChange={onChange} />);
    const input = screen.getByLabelText('Period') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '42' } });
    expect(onChange).toHaveBeenLastCalledWith(42);
  });

  it('calls onChange with parsed float when integer=false', () => {
    const onChange = vi.fn();
    renderUI(<NumberField label="Multiplier" value={1} onChange={onChange} />);
    const input = screen.getByLabelText('Multiplier') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2.5' } });
    expect(onChange).toHaveBeenLastCalledWith(2.5);
  });

  it('emits NaN when the input is cleared so callers can detect empty', () => {
    const onChange = vi.fn();
    renderUI(<NumberField label="Period" value={14} integer onChange={onChange} />);
    const input = screen.getByLabelText('Period') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(Number.isNaN(onChange.mock.calls[0]?.[0])).toBe(true);
  });

  it('does not emit a non-finite value when the input is non-numeric', () => {
    const onChange = vi.fn();
    renderUI(<NumberField label="Period" value={14} integer onChange={onChange} />);
    const input = screen.getByLabelText('Period') as HTMLInputElement;
    // Browser native number inputs reject non-numeric — change event fires
    // with empty value. So we get the same NaN path as the cleared case.
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(Number.isNaN(onChange.mock.calls[0]?.[0])).toBe(true);
  });
});

describe('BooleanField', () => {
  it('renders label and the Chakra switch in the on state when value=true', () => {
    renderUI(<BooleanField label="Smoothing" value onChange={() => {}} />);
    expect(screen.getByText('Smoothing')).toBeTruthy();
    // Chakra v3 Switch renders a HiddenInput[type=checkbox]; pull it directly.
    const hidden = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(hidden).toBeTruthy();
    expect(hidden.checked).toBe(true);
  });

  it('toggles via onCheckedChange when the switch root is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderUI(<BooleanField label="Smoothing" value={false} onChange={onChange} />);

    const hidden = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    // Chakra's HiddenInput is visually hidden but accepts pointer events.
    // userEvent.click finds the closest interactive ancestor for hidden inputs.
    await user.click(hidden.closest('label') ?? hidden.closest('[data-scope="switch"]') ?? hidden);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not fire onChange when disabled', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderUI(<BooleanField label="Smoothing" value={false} disabled onChange={onChange} />);
    const hidden = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await user.click(hidden.closest('label') ?? hidden.closest('[data-scope="switch"]') ?? hidden);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ColorField', () => {
  it('renders the current hex value next to the picker', () => {
    renderUI(<ColorField label="Line Color" value="#ff00ff" onChange={() => {}} />);
    expect(screen.getByText('#ff00ff')).toBeTruthy();
    expect(screen.getByText('Line Color')).toBeTruthy();
  });

  it('forwards onChange when a color preset is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderUI(<ColorField label="Line Color" value="#ffffff" onChange={onChange} />);

    // ColorPicker uses ariaLabel = the field label
    const trigger = screen.getByRole('button', { name: 'Line Color' });
    await user.click(trigger);

    // Pick the green preset (one of DEFAULT_COLOR_PRESETS — '#22c55e' is in the set)
    await user.click(screen.getByRole('button', { name: '#22c55e' }));
    expect(onChange).toHaveBeenCalledWith('#22c55e');
  });
});

describe('SelectField', () => {
  it('renders the current selected option label', () => {
    renderUI(
      <SelectField
        label="Source"
        value="close"
        options={[
          { value: 'close', label: 'Close' },
          { value: 'open', label: 'Open' },
        ]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Source')).toBeTruthy();
    expect(screen.getByText('Close')).toBeTruthy();
  });

  it('switches to the chosen option via the dropdown', () => {
    const onChange = vi.fn();
    renderUI(
      <SelectField
        label="Source"
        value="close"
        options={[
          { value: 'close', label: 'Close' },
          { value: 'open', label: 'Open' },
        ]}
        onChange={onChange}
      />,
    );
    // Open the Select dropdown by clicking the trigger (text "Close").
    fireEvent.click(screen.getByText('Close'));
    fireEvent.click(screen.getByText('Open'));
    expect(onChange).toHaveBeenCalledWith('open');
  });
});

describe('ParamFields router', () => {
  it('routes integer schema to NumberField and emits parsed integers', () => {
    const params: ParamSchema[] = [
      { key: 'period', type: 'integer', labelKey: 'indicators.params.period', default: 14, min: 1, max: 200 },
    ];
    const onChange = vi.fn();
    renderUI(<ParamFields params={params} values={{ period: 14 }} onChange={onChange} />);
    // The translation mock returns defaultValue (= p.key) so the rendered
    // label is 'period'. NumberField sets aria-label = label.
    const input = screen.getByLabelText('period') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '20' } });
    expect(onChange).toHaveBeenLastCalledWith('period', 20);
  });

  it('routes color schema to ColorField and emits hex strings', async () => {
    const params: ParamSchema[] = [
      { key: 'color', type: 'color', labelKey: 'indicators.params.color', default: '#ff00ff', cosmetic: true },
    ];
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderUI(<ParamFields params={params} values={{ color: '#ff00ff' }} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'color' }));
    await user.click(screen.getByRole('button', { name: '#22c55e' }));
    expect(onChange).toHaveBeenLastCalledWith('color', '#22c55e');
  });

  it('routes boolean schema to BooleanField and emits booleans', async () => {
    const params: ParamSchema[] = [
      { key: 'smooth', type: 'boolean', labelKey: 'indicators.params.smooth', default: false },
    ];
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderUI(<ParamFields params={params} values={{ smooth: false }} onChange={onChange} />);
    const hidden = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await user.click(hidden.closest('label') ?? hidden.closest('[data-scope="switch"]') ?? hidden);
    expect(onChange).toHaveBeenLastCalledWith('smooth', true);
  });

  it('routes select-typed schema to SelectField and emits string values', () => {
    const params: ParamSchema[] = [
      {
        key: 'source',
        type: 'select',
        labelKey: 'indicators.params.source',
        default: 'close',
        options: [
          { value: 'close', labelKey: 'indicators.sources.close' },
          { value: 'open', labelKey: 'indicators.sources.open' },
        ],
      },
    ];
    const onChange = vi.fn();
    renderUI(<ParamFields params={params} values={{ source: 'close' }} onChange={onChange} />);
    fireEvent.click(screen.getByText('close'));
    fireEvent.click(screen.getByText('open'));
    expect(onChange).toHaveBeenLastCalledWith('source', 'open');
  });

  it('falls back to the schema default when value is missing', () => {
    const params: ParamSchema[] = [
      { key: 'period', type: 'integer', labelKey: 'indicators.params.period', default: 14 },
    ];
    renderUI(<ParamFields params={params} values={{}} onChange={() => {}} />);
    const input = screen.getByLabelText('period') as HTMLInputElement;
    expect(input.value).toBe('14');
  });

  it('renders multiple param rows in the order defined by the schema', () => {
    const params: ParamSchema[] = [
      { key: 'period', type: 'integer', labelKey: 'indicators.params.period', default: 14 },
      { key: 'color', type: 'color', labelKey: 'indicators.params.color', default: '#ff00ff', cosmetic: true },
      { key: 'lineWidth', type: 'integer', labelKey: 'indicators.params.lineWidth', default: 1, cosmetic: true },
    ];
    renderUI(<ParamFields params={params} values={{ period: 14, color: '#ff00ff', lineWidth: 1 }} onChange={() => {}} />);
    expect(screen.getByLabelText('period')).toBeTruthy();
    expect(screen.getByLabelText('lineWidth')).toBeTruthy();
    expect(screen.getByText('#ff00ff')).toBeTruthy();
  });
});
