import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { ControlPanel } from './ControlPanel';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
);

describe('ControlPanel', () => {
  describe('rendering', () => {
    it('should render with title', () => {
      render(
        <Wrapper>
          <ControlPanel title="Test Panel">
            <div>Content</div>
          </ControlPanel>
        </Wrapper>
      );

      expect(screen.getByText('Test Panel')).toBeInTheDocument();
    });

    it('should render children when expanded', () => {
      render(
        <Wrapper>
          <ControlPanel title="Test Panel">
            <div>Test Content</div>
          </ControlPanel>
        </Wrapper>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should be expanded by default', () => {
      render(
        <Wrapper>
          <ControlPanel title="Test Panel">
            <div>Test Content</div>
          </ControlPanel>
        </Wrapper>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should respect defaultExpanded=false', () => {
      render(
        <Wrapper>
          <ControlPanel title="Test Panel" defaultExpanded={false}>
            <div>Hidden Content</div>
          </ControlPanel>
        </Wrapper>
      );

      expect(screen.queryByText('Hidden Content')).not.toBeInTheDocument();
    });
  });

  describe('toggle functionality', () => {
    it('should collapse when clicking header', async () => {
      const user = userEvent.setup();

      render(
        <Wrapper>
          <ControlPanel title="Test Panel">
            <div>Test Content</div>
          </ControlPanel>
        </Wrapper>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();

      await user.click(screen.getByText('Test Panel'));

      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    });

    it('should expand when clicking header on collapsed panel', async () => {
      const user = userEvent.setup();

      render(
        <Wrapper>
          <ControlPanel title="Test Panel" defaultExpanded={false}>
            <div>Hidden Content</div>
          </ControlPanel>
        </Wrapper>
      );

      expect(screen.queryByText('Hidden Content')).not.toBeInTheDocument();

      await user.click(screen.getByText('Test Panel'));

      expect(screen.getByText('Hidden Content')).toBeInTheDocument();
    });

    it('should toggle expand/collapse on multiple clicks', async () => {
      const user = userEvent.setup();

      render(
        <Wrapper>
          <ControlPanel title="Test Panel">
            <div>Toggle Content</div>
          </ControlPanel>
        </Wrapper>
      );

      const header = screen.getByText('Test Panel');

      expect(screen.getByText('Toggle Content')).toBeInTheDocument();
      await user.click(header);
      expect(screen.queryByText('Toggle Content')).not.toBeInTheDocument();
      await user.click(header);
      expect(screen.getByText('Toggle Content')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have correct aria-label when expanded', () => {
      render(
        <Wrapper>
          <ControlPanel title="Test Panel">
            <div>Content</div>
          </ControlPanel>
        </Wrapper>
      );

      expect(screen.getByRole('button', { name: 'Collapse panel' })).toBeInTheDocument();
    });

    it('should have correct aria-label when collapsed', () => {
      render(
        <Wrapper>
          <ControlPanel title="Test Panel" defaultExpanded={false}>
            <div>Content</div>
          </ControlPanel>
        </Wrapper>
      );

      expect(screen.getByRole('button', { name: 'Expand panel' })).toBeInTheDocument();
    });
  });

  describe('with complex children', () => {
    it('should render multiple children', () => {
      render(
        <Wrapper>
          <ControlPanel title="Test Panel">
            <div>Child 1</div>
            <div>Child 2</div>
            <div>Child 3</div>
          </ControlPanel>
        </Wrapper>
      );

      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
      expect(screen.getByText('Child 3')).toBeInTheDocument();
    });
  });
});
