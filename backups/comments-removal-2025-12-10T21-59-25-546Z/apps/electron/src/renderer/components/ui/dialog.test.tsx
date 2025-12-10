import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Dialog } from './dialog';

const renderWithChakra = (ui: ReactElement) => render(
    <ChakraProvider value={defaultSystem}>
        {ui}
    </ChakraProvider>
);

const TestDialog = ({ onClose = vi.fn() }: { onClose?: () => void }) => {
    const [open, setOpen] = useState(true);

    const handleClose = () => {
        setOpen(false);
        onClose();
    };

    return (
        <Dialog.Root open={open} onOpenChange={(e) => e.open ? setOpen(true) : handleClose()}>
            <Dialog.Backdrop />
            <Dialog.Positioner>
                <Dialog.Content>
                    <Dialog.Header>
                        <Dialog.Title>Test Dialog</Dialog.Title>
                        <Dialog.CloseTrigger />
                    </Dialog.Header>
                    <Dialog.Body>
                        This is the dialog body content.
                    </Dialog.Body>
                    <Dialog.Footer>
                        <Dialog.ActionTrigger>
                            Cancel
                        </Dialog.ActionTrigger>
                    </Dialog.Footer>
                </Dialog.Content>
            </Dialog.Positioner>
        </Dialog.Root>
    );
};

describe('Dialog', () => {
    it('should render dialog with all components', () => {
        renderWithChakra(<TestDialog />);

        expect(screen.getByText('Test Dialog')).toBeInTheDocument();
        expect(screen.getByText('This is the dialog body content.')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should render DialogRoot with default placement', () => {
        const { container } = renderWithChakra(
            <Dialog.Root open>
                <Dialog.Content>Content</Dialog.Content>
            </Dialog.Root>
        );

        expect(container.firstChild).toBeInTheDocument();
    });

    it('should render DialogRoot with custom placement', () => {
        const { container } = renderWithChakra(
            <Dialog.Root open placement="top">
                <Dialog.Content>Content</Dialog.Content>
            </Dialog.Root>
        );

        expect(container.firstChild).toBeInTheDocument();
    });

    it('should render DialogBackdrop', () => {
        const { container } = renderWithChakra(
            <Dialog.Root open>
                <Dialog.Backdrop />
                <Dialog.Content>Content</Dialog.Content>
            </Dialog.Root>
        );

        expect(container.firstChild).toBeInTheDocument();
    });

    it('should render DialogPositioner', () => {
        const { container } = renderWithChakra(
            <Dialog.Root open>
                <Dialog.Positioner>
                    <Dialog.Content>Content</Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>
        );

        expect(container.firstChild).toBeInTheDocument();
    });

    it('should render DialogContent', () => {
        renderWithChakra(
            <Dialog.Root open>
                <Dialog.Content>Content here</Dialog.Content>
            </Dialog.Root>
        );

        expect(screen.getByText('Content here')).toBeInTheDocument();
    });

    it('should render DialogHeader with default padding', () => {
        renderWithChakra(
            <Dialog.Root open>
                <Dialog.Content>
                    <Dialog.Header>Header Text</Dialog.Header>
                </Dialog.Content>
            </Dialog.Root>
        );

        expect(screen.getByText('Header Text')).toBeInTheDocument();
    });

    it('should render DialogHeader with custom padding', () => {
        renderWithChakra(
            <Dialog.Root open>
                <Dialog.Content>
                    <Dialog.Header px={8} py={6}>Custom Header</Dialog.Header>
                </Dialog.Content>
            </Dialog.Root>
        );

        expect(screen.getByText('Custom Header')).toBeInTheDocument();
    });

    it('should render DialogTitle', () => {
        renderWithChakra(
            <Dialog.Root open>
                <Dialog.Content>
                    <Dialog.Header>
                        <Dialog.Title>Dialog Title</Dialog.Title>
                    </Dialog.Header>
                </Dialog.Content>
            </Dialog.Root>
        );

        expect(screen.getByText('Dialog Title')).toBeInTheDocument();
    });

    it('should render DialogBody with default padding', () => {
        renderWithChakra(
            <Dialog.Root open>
                <Dialog.Content>
                    <Dialog.Body>Body content</Dialog.Body>
                </Dialog.Content>
            </Dialog.Root>
        );

        expect(screen.getByText('Body content')).toBeInTheDocument();
    });

    it('should render DialogBody with custom padding', () => {
        renderWithChakra(
            <Dialog.Root open>
                <Dialog.Content>
                    <Dialog.Body px={8} py={6}>Custom Body</Dialog.Body>
                </Dialog.Content>
            </Dialog.Root>
        );

        expect(screen.getByText('Custom Body')).toBeInTheDocument();
    });

    it('should render DialogFooter with default padding', () => {
        renderWithChakra(
            <Dialog.Root open>
                <Dialog.Content>
                    <Dialog.Footer>Footer content</Dialog.Footer>
                </Dialog.Content>
            </Dialog.Root>
        );

        expect(screen.getByText('Footer content')).toBeInTheDocument();
    });

    it('should render DialogFooter with custom padding', () => {
        renderWithChakra(
            <Dialog.Root open>
                <Dialog.Content>
                    <Dialog.Footer px={8} py={6}>Custom Footer</Dialog.Footer>
                </Dialog.Content>
            </Dialog.Root>
        );

        expect(screen.getByText('Custom Footer')).toBeInTheDocument();
    });

    it('should render DialogCloseTrigger', () => {
        const { container } = renderWithChakra(
            <Dialog.Root open>
                <Dialog.Content>
                    <Dialog.CloseTrigger />
                </Dialog.Content>
            </Dialog.Root>
        );

        expect(container.firstChild).toBeInTheDocument();
    });

    it('should render DialogActionTrigger', () => {
        renderWithChakra(
            <Dialog.Root open>
                <Dialog.Content>
                    <Dialog.Footer>
                        <Dialog.ActionTrigger>
                            Action Button
                        </Dialog.ActionTrigger>
                    </Dialog.Footer>
                </Dialog.Content>
            </Dialog.Root>
        );

        expect(screen.getByText('Action Button')).toBeInTheDocument();
    });

    it('should close dialog when ActionTrigger is clicked', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();

        renderWithChakra(<TestDialog onClose={onClose} />);

        const cancelButton = screen.getByText('Cancel');
        await user.click(cancelButton);

        expect(onClose).toHaveBeenCalled();
    });

    it('should export Dialog object with all components', () => {
        expect(Dialog.Root).toBeDefined();
        expect(Dialog.Backdrop).toBeDefined();
        expect(Dialog.Positioner).toBeDefined();
        expect(Dialog.Content).toBeDefined();
        expect(Dialog.Header).toBeDefined();
        expect(Dialog.Title).toBeDefined();
        expect(Dialog.Body).toBeDefined();
        expect(Dialog.Footer).toBeDefined();
        expect(Dialog.CloseTrigger).toBeDefined();
        expect(Dialog.ActionTrigger).toBeDefined();
    });
});
