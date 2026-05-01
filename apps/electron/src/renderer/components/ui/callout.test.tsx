import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Callout, type CalloutTone } from '@marketmind/ui';

const renderCallout = (props: Parameters<typeof Callout>[0]) =>
  render(
    <ChakraProvider value={defaultSystem}>
      <Callout {...props} />
    </ChakraProvider>
  );

describe('Callout', () => {
  it('renders body content when no title', () => {
    renderCallout({ children: 'Body only' });
    expect(screen.getByText('Body only')).toBeDefined();
  });

  it('renders title and body together', () => {
    renderCallout({ title: 'My title', children: 'Body text' });
    expect(screen.getByText('My title')).toBeDefined();
    expect(screen.getByText('Body text')).toBeDefined();
  });

  it.each<CalloutTone>(['info', 'success', 'warning', 'danger', 'neutral'])(
    'renders with %s tone',
    (tone) => {
      renderCallout({ tone, children: `Tone: ${tone}` });
      expect(screen.getByText(`Tone: ${tone}`)).toBeDefined();
    }
  );

  it('uses default info tone when none specified', () => {
    const { container } = renderCallout({ children: 'Default' });
    // svg is the default LuInfo icon for info tone
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders custom icon when provided', () => {
    const { container } = renderCallout({
      icon: <svg data-testid="custom-icon" />,
      children: 'Custom',
    });
    expect(container.querySelector('[data-testid="custom-icon"]')).not.toBeNull();
  });

  it('renders with compact spacing when compact=true', () => {
    renderCallout({ compact: true, children: 'Compact' });
    expect(screen.getByText('Compact')).toBeDefined();
  });

  it('renders with default (non-compact) spacing', () => {
    renderCallout({ children: 'Default spacing' });
    expect(screen.getByText('Default spacing')).toBeDefined();
  });

  it('renders only title without body', () => {
    renderCallout({ title: 'Title only' });
    expect(screen.getByText('Title only')).toBeDefined();
  });
});
