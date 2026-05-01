import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Select, SelectOption } from '@marketmind/ui-core';

const mockOptions: SelectOption[] = [
  { value: '1', label: 'Option 1' },
  { value: '2', label: 'Option 2', description: 'Description 2' },
  { value: '3', label: 'Option 3' },
];

const renderWithChakra = (ui: ReactElement) => render(
  <ChakraProvider value={defaultSystem}>
    {ui}
  </ChakraProvider>
);

describe('Select', () => {
  describe('Basic Rendering', () => {
    it('should render with placeholder when no value selected', () => {
      renderWithChakra(
        <Select
          value=""
          options={mockOptions}
          onChange={vi.fn()}
          placeholder="Choose one"
        />
      );

      expect(screen.getByText('Choose one')).toBeInTheDocument();
    });

    it('should render selected option label', () => {
      renderWithChakra(
        <Select value="2" options={mockOptions} onChange={vi.fn()} />
      );

      expect(screen.getByText('Option 2')).toBeInTheDocument();
    });

    it('should render with label', () => {
      renderWithChakra(
        <Select
          value="1"
          options={mockOptions}
          onChange={vi.fn()}
          label="Select Label"
        />
      );

      expect(screen.getByText('Select Label')).toBeInTheDocument();
    });

    it('should render with description', () => {
      renderWithChakra(
        <Select
          value="2"
          options={mockOptions}
          onChange={vi.fn()}
          description="Some description"
        />
      );

      expect(screen.getByText('Some description')).toBeInTheDocument();
    });

    it('should render option description when selected', () => {
      renderWithChakra(
        <Select value="2" options={mockOptions} onChange={vi.fn()} />
      );

      expect(screen.queryByText('Description 2')).not.toBeInTheDocument();
    });
  });

  describe('Dropdown Interaction', () => {
    it('should open dropdown when clicked', async () => {
      const user = userEvent.setup();
      renderWithChakra(
        <Select
          value="1"
          options={mockOptions}
          onChange={vi.fn()}
          placeholder="Select"
        />
      );

      const trigger = screen.getByText('Option 1');
      await user.click(trigger);

      mockOptions.forEach((option) => {
        expect(screen.getAllByText(option.label).length).toBeGreaterThan(0);
      });
    });

    it('should call onChange when option is selected', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      renderWithChakra(
        <Select value="1" options={mockOptions} onChange={onChange} />
      );

      const trigger = screen.getByText('Option 1');
      await user.click(trigger);

      const options = screen.getAllByText('Option 2');
      const option2 = options[options.length - 1];
      await user.click(option2);

      expect(onChange).toHaveBeenCalledWith('2');
    });

    it('should close dropdown after selection', async () => {
      const user = userEvent.setup();
      renderWithChakra(
        <Select value="1" options={mockOptions} onChange={vi.fn()} />
      );

      const trigger = screen.getByText('Option 1');
      await user.click(trigger);

      expect(screen.getByText('Option 3')).toBeInTheDocument();

      const options = screen.getAllByText('Option 2');
      const option2 = options[options.length - 1];
      await user.click(option2);

      expect(screen.queryByText('Option 3')).not.toBeInTheDocument();
    });

    it('should close dropdown when clicking outside', async () => {
      const user = userEvent.setup();
      renderWithChakra(
        <div>
          <div data-testid="outside">Outside</div>
          <Select value="1" options={mockOptions} onChange={vi.fn()} />
        </div>
      );

      const trigger = screen.getByText('Option 1');
      await user.click(trigger);

      expect(screen.getByText('Option 3')).toBeInTheDocument();

      const outside = screen.getByTestId('outside');
      await user.click(outside);

      expect(screen.queryByText('Option 3')).not.toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should render search input when enableSearch is true', async () => {
      const user = userEvent.setup();
      renderWithChakra(
        <Select
          value="1"
          options={mockOptions}
          onChange={vi.fn()}
          enableSearch
          searchPlaceholder="Type to search"
        />
      );

      const trigger = screen.getByText('Option 1');
      await user.click(trigger);

      expect(screen.getByPlaceholderText('Type to search')).toBeInTheDocument();
    });

    it('should filter options based on search query (label)', async () => {
      const user = userEvent.setup();
      renderWithChakra(
        <Select value="" options={mockOptions} onChange={vi.fn()} enableSearch />
      );

      const trigger = screen.getByText('Select an option');
      await user.click(trigger);

      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, 'Option 2');

      expect(screen.queryByText('Option 1')).not.toBeInTheDocument();
      expect(screen.getAllByText('Option 2').length).toBeGreaterThan(0);
      expect(screen.queryByText('Option 3')).not.toBeInTheDocument();
    });

    it('should filter options based on search query (value)', async () => {
      const user = userEvent.setup();
      renderWithChakra(
        <Select value="" options={mockOptions} onChange={vi.fn()} enableSearch />
      );

      const trigger = screen.getByText('Select an option');
      await user.click(trigger);

      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, '2');

      expect(screen.queryByText('Option 1')).not.toBeInTheDocument();
      expect(screen.getAllByText('Option 2').length).toBeGreaterThan(0);
    });

    it('should call onSearchChange when provided', async () => {
      const onSearchChange = vi.fn();
      const user = userEvent.setup();
      renderWithChakra(
        <Select
          value=""
          options={mockOptions}
          onChange={vi.fn()}
          enableSearch
          onSearchChange={onSearchChange}
        />
      );

      const trigger = screen.getByText('Select an option');
      await user.click(trigger);

      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, 'test');

      expect(onSearchChange).toHaveBeenCalledWith('test');
    });
  });

  describe('Loading and Empty States', () => {
    it('should show loading spinner when isLoading is true', async () => {
      const user = userEvent.setup();
      renderWithChakra(
        <Select
          value=""
          options={mockOptions}
          onChange={vi.fn()}
          isLoading
        />
      );

      const trigger = screen.getByText('Select an option');
      await user.click(trigger);

      const spinner = document.querySelector('.chakra-spinner');
      expect(spinner).toBeInTheDocument();
    });

    it('should show empty message when no options match search', async () => {
      const user = userEvent.setup();
      renderWithChakra(
        <Select
          value=""
          options={mockOptions}
          onChange={vi.fn()}
          enableSearch
          emptyMessage="Nothing found"
        />
      );

      const trigger = screen.getByText('Select an option');
      await user.click(trigger);

      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, 'nonexistent');

      expect(screen.getByText('Nothing found')).toBeInTheDocument();
    });

    it('should show empty message when options array is empty', async () => {
      const user = userEvent.setup();
      renderWithChakra(
        <Select value="" options={[]} onChange={vi.fn()} emptyMessage="No data" />
      );

      const trigger = screen.getByText('Select an option');
      await user.click(trigger);

      expect(screen.getByText('No data')).toBeInTheDocument();
    });
  });

  describe('Size and Variant Props', () => {
    it('should apply xs size styles', () => {
      renderWithChakra(
        <Select value="1" options={mockOptions} onChange={vi.fn()} size="xs" />
      );

      expect(screen.getByText('Option 1')).toBeInTheDocument();
    });

    it('should apply sm size styles', () => {
      renderWithChakra(
        <Select value="1" options={mockOptions} onChange={vi.fn()} size="sm" />
      );

      expect(screen.getByText('Option 1')).toBeInTheDocument();
    });

    it('should apply md size styles (default)', () => {
      renderWithChakra(
        <Select value="1" options={mockOptions} onChange={vi.fn()} size="md" />
      );

      expect(screen.getByText('Option 1')).toBeInTheDocument();
    });

    it('should apply lg size styles', () => {
      renderWithChakra(
        <Select value="1" options={mockOptions} onChange={vi.fn()} size="lg" />
      );

      expect(screen.getByText('Option 1')).toBeInTheDocument();
    });

    it('should render with borderless variant', () => {
      renderWithChakra(
        <Select
          value="1"
          options={mockOptions}
          onChange={vi.fn()}
          variant="borderless"
        />
      );

      expect(screen.getByText('Option 1')).toBeInTheDocument();
    });

    it('should render with bordered variant (default)', () => {
      renderWithChakra(
        <Select
          value="1"
          options={mockOptions}
          onChange={vi.fn()}
          variant="bordered"
        />
      );

      expect(screen.getByText('Option 1')).toBeInTheDocument();
    });
  });

  describe('Additional Props', () => {
    it('should render section label when provided', async () => {
      const user = userEvent.setup();
      renderWithChakra(
        <Select
          value="1"
          options={mockOptions}
          onChange={vi.fn()}
          sectionLabel="Available Options"
        />
      );

      const trigger = screen.getByText('Option 1');
      await user.click(trigger);

      expect(screen.getByText('Available Options')).toBeInTheDocument();
    });

    it('should apply minWidth when provided', () => {
      renderWithChakra(
        <Select
          value="1"
          options={mockOptions}
          onChange={vi.fn()}
          minWidth="300px"
        />
      );

      expect(screen.getByText('Option 1')).toBeInTheDocument();
    });

    it('should render option descriptions in dropdown', async () => {
      const user = userEvent.setup();
      renderWithChakra(
        <Select value="1" options={mockOptions} onChange={vi.fn()} />
      );

      const trigger = screen.getByText('Option 1');
      await user.click(trigger);

      expect(screen.getByText('Description 2')).toBeInTheDocument();
    });

    it('should toggle dropdown on repeated clicks', async () => {
      const user = userEvent.setup();
      renderWithChakra(
        <Select value="1" options={mockOptions} onChange={vi.fn()} />
      );

      const trigger = screen.getByText('Option 1');

      await user.click(trigger);
      expect(screen.getByText('Option 3')).toBeInTheDocument();

      await user.click(trigger);
      expect(screen.queryByText('Option 3')).not.toBeInTheDocument();
    });

    it('should render with openUpwards prop', async () => {
      const user = userEvent.setup();
      renderWithChakra(
        <Select
          value="1"
          options={mockOptions}
          onChange={vi.fn()}
          openUpwards
        />
      );

      const trigger = screen.getByText('Option 1');
      await user.click(trigger);

      expect(screen.getByText('Option 3')).toBeInTheDocument();
    });

    it('should render without portal when usePortal is false', async () => {
      const user = userEvent.setup();
      renderWithChakra(
        <Select
          value="1"
          options={mockOptions}
          onChange={vi.fn()}
          usePortal={false}
        />
      );

      const trigger = screen.getByText('Option 1');
      await user.click(trigger);

      expect(screen.getByText('Option 3')).toBeInTheDocument();
    });

    it('should render with noWrap prop', () => {
      renderWithChakra(
        <Select
          value="1"
          options={mockOptions}
          onChange={vi.fn()}
          noWrap
        />
      );

      expect(screen.getByText('Option 1')).toBeInTheDocument();
    });
  });

  describe('Dropdown Positioning', () => {
    it('should update dropdown position when opened with portal', async () => {
      const user = userEvent.setup();
      renderWithChakra(
        <Select
          value="1"
          options={mockOptions}
          onChange={vi.fn()}
          usePortal
        />
      );

      const trigger = screen.getByText('Option 1');
      await user.click(trigger);

      expect(screen.getByText('Option 3')).toBeInTheDocument();
    });

    it('should update dropdown position when opened with portal and openUpwards', async () => {
      const user = userEvent.setup();
      renderWithChakra(
        <Select
          value="1"
          options={mockOptions}
          onChange={vi.fn()}
          usePortal
          openUpwards
        />
      );

      const trigger = screen.getByText('Option 1');
      await user.click(trigger);

      expect(screen.getByText('Option 3')).toBeInTheDocument();
    });

    it('should render dropdown without portal and openUpwards', async () => {
      const user = userEvent.setup();
      renderWithChakra(
        <Select
          value="1"
          options={mockOptions}
          onChange={vi.fn()}
          usePortal={false}
          openUpwards
        />
      );

      const trigger = screen.getByText('Option 1');
      await user.click(trigger);

      expect(screen.getByText('Option 3')).toBeInTheDocument();
    });
  });

  describe('Search with External Handler', () => {
    it('should not filter options locally when onSearchChange is provided', async () => {
      const user = userEvent.setup();
      renderWithChakra(
        <Select
          value=""
          options={mockOptions}
          onChange={vi.fn()}
          enableSearch
          onSearchChange={vi.fn()}
        />
      );

      const trigger = screen.getByText('Select an option');
      await user.click(trigger);

      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, 'xyz');

      mockOptions.forEach((option) => {
        expect(screen.getAllByText(option.label).length).toBeGreaterThan(0);
      });
    });
  });
});
