/**
 * @marketmind/ui-core — Tier-1 + Tier-2 UI primitives.
 *
 * Tier 1: pure Chakra wrappers (Alert, Badge, Button, ...).
 * Tier 2: token-aware composed primitives (Callout, FormSection,
 *   PanelHeader, typography family, DialogSection, CreateActionButton,
 *   ColorPicker, Sidebar). They depend on @marketmind/tokens.
 *
 * Tier 3 (i18n / runtime-coupled — DialogShell with `useTranslation`,
 * MetricCard/PnLDisplay/TooltipWrapper with `useColorMode`,
 * ConfirmationDialog/EmptyState/etc with i18n) stays app-side.
 */

// Tier 1
export { Alert, type AlertRootProps } from './alert';
export { Badge, type BadgeProps } from './badge';
export { BetaBadge, type BetaBadgeProps } from './beta-badge';
export { Button, type ButtonProps } from './button';
export { Card } from './card';
export { Checkbox, type CheckboxProps } from './checkbox';
export { CloseButton, type CloseButtonProps } from './close-button';
export { DataCard } from './data-card';
export {
  Dialog,
  DialogActionTrigger,
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
export { Field } from './field';
export { IconButton, type IconButtonProps } from './icon-button';
export { Image, type ImageProps } from './image';
export { Input } from './input';
export { Link, type LinkProps } from './link';
export { Logo } from './logo';
export { Menu } from './menu';
export { NumberInput, type NumberInputProps } from './number-input';
export { PasswordInput, type PasswordInputProps } from './password-input';
export { Popover } from './popover';
export { ProgressBar, ProgressRoot } from './progress';
export { Radio, RadioGroup, type RadioGroupProps, type RadioProps } from './radio';
export { Select, type SelectOption, type SelectProps } from './select';
export { Separator, type SeparatorProps } from './separator';
export { Skeleton, type SkeletonProps } from './skeleton';
export { Slider } from './slider';
export { Stat, StatRow } from './stat';
export { Switch } from './switch';
export { Table } from './table';
export { Tabs } from './tabs';
export { Textarea, type TextareaProps } from './textarea';
export { ToggleIconButton, type ToggleIconButtonProps } from './toggle-icon-button';

// Tier 2 — token-aware composed primitives
export { Callout, type CalloutTone } from './callout';
export { ColorPicker, DEFAULT_COLOR_PRESETS, type ColorPickerProps } from './color-picker';
export { CreateActionButton, type CreateActionButtonProps } from './create-action-button';
export { DialogSection, type DialogSectionProps } from './dialog-section';
export { FormRow, FormSection } from './form-section';
export { PanelHeader } from './panel-header';
export { SidebarContainer, SidebarHeader } from './Sidebar';
export {
  FieldHint,
  MetaText,
  PageTitle,
  SectionDescription,
  SectionTitle,
  SubsectionTitle,
} from './typography';
