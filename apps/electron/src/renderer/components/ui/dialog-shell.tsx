import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { MM } from '@marketmind/tokens';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import { CloseButton } from './close-button';
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
} from './dialog';

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface DialogShellProps {
  isOpen: boolean;
  onClose: () => void;
  /** Required title rendered with `MM.typography.dialogTitle`. Accepts a string or a ReactNode for inline embellishments (badge, icon). */
  title: ReactNode;
  /** Optional one-line description below the title (`MM.typography.dialogDescription`). */
  description?: ReactNode;
  /** Optional inline action rendered on the right of the header (e.g. "Reset"). */
  headerAction?: ReactNode;
  /** Width token. Defaults to `md`. */
  size?: DialogSize;
  /** Custom footer override. When set, defaultFooter (Cancel + primary) is replaced. */
  footer?: ReactNode;
  /** When true, esc/click-outside are blocked so an in-flight mutation isn't orphaned. */
  isLoading?: boolean;
  /** When provided, the default footer renders Cancel + a primary button calling this. */
  onSubmit?: () => void;
  submitLabel?: string;
  submitColorPalette?: string;
  submitDisabled?: boolean;
  /** Hide the footer entirely. */
  hideFooter?: boolean;
  /** Hide the close button (rare — typically only for full-screen dialogs). */
  hideCloseButton?: boolean;
  /** Body padding override (defaults to `MM.dialog.bodyPadding`). */
  bodyPadding?: number | string;
  /** When set, body becomes scrollable up to this height (typical: `90vh`). */
  contentMaxH?: string;
  children: ReactNode;
}

/**
 * The standard dialog primitive for v1.6+. Replaces hand-rolled
 * `<Dialog.Root> → <Dialog.Backdrop> → <Dialog.Positioner> →
 * <Dialog.Content>` chains across the app.
 *
 * Reads from `MM.dialog.*` tokens for size/padding and
 * `MM.typography.dialog*` for title/description so every dialog
 * agrees on width, header padding, and title style without
 * per-callsite overrides.
 *
 * v1.6 Track A.1.
 */
export const DialogShell = ({
  isOpen,
  onClose,
  title,
  description,
  headerAction,
  size = 'md',
  footer,
  isLoading = false,
  onSubmit,
  submitLabel,
  submitColorPalette = 'blue',
  submitDisabled = false,
  hideFooter = false,
  hideCloseButton = false,
  bodyPadding = MM.dialog.bodyPadding,
  contentMaxH,
  children,
}: DialogShellProps) => {
  const { t } = useTranslation();

  const handleOpenChange = (e: { open: boolean }) => {
    if (!e.open && !isLoading) onClose();
  };

  const sizeProps = MM.dialog.size[size];

  const defaultFooter = onSubmit && (
    <>
      <Button
        size="2xs"
        variant="ghost"
        onClick={onClose}
        disabled={isLoading}
        px={3}
      >
        {t('common.cancel')}
      </Button>
      <Button
        size="2xs"
        colorPalette={submitColorPalette}
        onClick={onSubmit}
        disabled={submitDisabled || isLoading}
        loading={isLoading}
        px={3}
      >
        {submitLabel ?? t('common.save')}
      </Button>
    </>
  );

  return (
    <DialogRoot open={isOpen} onOpenChange={handleOpenChange}>
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent
          maxW={sizeProps.maxW}
          w={'w' in sizeProps ? sizeProps.w : undefined}
          maxH={contentMaxH ?? '90vh'}
        >
          <DialogHeader
            px={MM.dialog.headerPadding.x}
            pt={MM.dialog.headerPadding.top}
            pb={MM.dialog.headerPadding.bottom}
          >
            <Flex align="flex-start" justify="space-between" gap={3}>
              <Box flex={1} minW={0}>
                <DialogTitle
                  fontSize={MM.typography.dialogTitle.fontSize}
                  fontWeight={MM.typography.dialogTitle.fontWeight}
                  lineHeight={MM.typography.dialogTitle.lineHeight}
                >
                  {title}
                </DialogTitle>
                {description !== undefined && (
                  <Text
                    fontSize={MM.typography.dialogDescription.fontSize}
                    color={MM.typography.dialogDescription.color}
                    lineHeight={MM.typography.dialogDescription.lineHeight}
                    mt={0.5}
                  >
                    {description}
                  </Text>
                )}
              </Box>
              {headerAction !== undefined && (
                <Box flexShrink={0}>{headerAction}</Box>
              )}
            </Flex>
          </DialogHeader>

          {!hideCloseButton && (
            <DialogCloseTrigger asChild>
              <CloseButton size="sm" />
            </DialogCloseTrigger>
          )}

          <DialogBody p={bodyPadding} overflowY="auto">
            <Stack gap={MM.dialog.sectionGap}>{children}</Stack>
          </DialogBody>

          {!hideFooter && (
            <DialogFooter
              px={MM.dialog.footerPadding.x}
              py={MM.dialog.footerPadding.y}
              borderTop="1px solid"
              borderColor="border"
              gap={2}
            >
              {footer ?? defaultFooter}
            </DialogFooter>
          )}
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
};
