import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HorizontalLineDrawing, LineDrawing } from '@marketmind/chart-studies';
import { useDrawingStore } from '@renderer/store/drawingStore';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { DrawingPropertiesDialog } from './DrawingPropertiesDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

const baseHLine: HorizontalLineDrawing = {
  id: 'hl-test-1',
  type: 'horizontalLine',
  symbol: 'BTCUSDT',
  interval: '1h',
  createdAt: 0,
  updatedAt: 0,
  visible: true,
  locked: false,
  zIndex: 0,
  index: 0,
  price: 78500,
};

const baseLine: LineDrawing = {
  id: 'l-test-1',
  type: 'line',
  symbol: 'BTCUSDT',
  interval: '1h',
  createdAt: 0,
  updatedAt: 0,
  visible: true,
  locked: false,
  zIndex: 0,
  startIndex: 0,
  startPrice: 100,
  endIndex: 5,
  endPrice: 200,
};

const mockManager = {
  markDirty: vi.fn(),
} as unknown as CanvasManager;

const renderWithProvider = (ui: React.ReactNode) =>
  render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);

beforeEach(() => {
  useDrawingStore.setState({
    drawingsByKey: { 'BTCUSDT:1h': [baseHLine] },
    activeTool: null,
    selectedDrawingId: 'hl-test-1',
    magnetEnabled: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('DrawingPropertiesDialog — horizontal line', () => {
  it('renders price input pre-filled with the drawing price', () => {
    renderWithProvider(
      <DrawingPropertiesDialog isOpen onClose={() => {}} drawing={baseHLine} manager={mockManager} />,
    );
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('78500');
  });

  it('writes the new price to the store on blur', async () => {
    const user = userEvent.setup();
    renderWithProvider(
      <DrawingPropertiesDialog isOpen onClose={() => {}} drawing={baseHLine} manager={mockManager} />,
    );
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '79000');
    await user.tab();

    const updated = useDrawingStore.getState().drawingsByKey['BTCUSDT:1h']?.[0] as HorizontalLineDrawing;
    expect(updated.price).toBe(79000);
  });

  it('triggers manager.markDirty after committing a change', async () => {
    const user = userEvent.setup();
    renderWithProvider(
      <DrawingPropertiesDialog isOpen onClose={() => {}} drawing={baseHLine} manager={mockManager} />,
    );
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '79123');
    await user.tab();

    expect(mockManager.markDirty).toHaveBeenCalledWith('overlays');
  });

  it('commits + closes on Enter keypress', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProvider(
      <DrawingPropertiesDialog isOpen onClose={onClose} drawing={baseHLine} manager={mockManager} />,
    );
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '80000{Enter}');

    const updated = useDrawingStore.getState().drawingsByKey['BTCUSDT:1h']?.[0] as HorizontalLineDrawing;
    expect(updated.price).toBe(80000);
    expect(onClose).toHaveBeenCalled();
  });

  it('rejects non-numeric input by reverting to the previous value', async () => {
    const user = userEvent.setup();
    renderWithProvider(
      <DrawingPropertiesDialog isOpen onClose={() => {}} drawing={baseHLine} manager={mockManager} />,
    );
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    await user.clear(input);
    await user.tab(); // commit empty

    const updated = useDrawingStore.getState().drawingsByKey['BTCUSDT:1h']?.[0] as HorizontalLineDrawing;
    expect(updated.price).toBe(78500); // unchanged
  });

  it('does not write to store when value equals current price', async () => {
    const user = userEvent.setup();
    const updateSpy = vi.spyOn(useDrawingStore.getState(), 'updateDrawing');
    renderWithProvider(
      <DrawingPropertiesDialog isOpen onClose={() => {}} drawing={baseHLine} manager={mockManager} />,
    );
    const input = screen.getByRole('spinbutton');
    await user.click(input);
    await user.tab(); // blur with same value

    expect(updateSpy).not.toHaveBeenCalled();
    updateSpy.mockRestore();
  });
});

describe('DrawingPropertiesDialog — bidirectional binding', () => {
  it('input syncs with store updates while dialog is open (drag-to-input direction)', async () => {
    const { rerender } = renderWithProvider(
      <DrawingPropertiesDialog isOpen onClose={() => {}} drawing={baseHLine} manager={mockManager} />,
    );
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('78500');

    // Simulate the user dragging the line: the parent re-renders with a new
    // drawing.price. The dialog's input should follow.
    const moved: HorizontalLineDrawing = { ...baseHLine, price: 78600 };
    rerender(
      <ChakraProvider value={defaultSystem}>
        <DrawingPropertiesDialog isOpen onClose={() => {}} drawing={moved} manager={mockManager} />
      </ChakraProvider>,
    );
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('78600');
  });
});

describe('DrawingPropertiesDialog — non-supported types', () => {
  it('renders a placeholder for drawing kinds without a panel yet (line)', () => {
    renderWithProvider(
      <DrawingPropertiesDialog isOpen onClose={() => {}} drawing={baseLine} manager={mockManager} />,
    );
    expect(screen.getByText(/no advanced properties/i)).toBeInTheDocument();
  });

  it('returns null when drawing is null', () => {
    const { container } = renderWithProvider(
      <DrawingPropertiesDialog isOpen onClose={() => {}} drawing={null} manager={mockManager} />,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
