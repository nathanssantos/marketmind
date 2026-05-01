// Tier-1 primitives extracted into @marketmind/ui-core (v1.6 Track B.1).
// Re-exported here so existing app-site imports (`@renderer/components/ui`)
// keep working without per-callsite churn.
export {
  Alert,
  Badge,
  BetaBadge,
  Button,
  Card,
  Checkbox,
  CloseButton,
  DataCard,
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
  Field,
  IconButton,
  Image,
  Input,
  Link,
  Logo,
  Menu,
  NumberInput,
  PasswordInput,
  Popover,
  ProgressBar,
  ProgressRoot,
  Radio,
  RadioGroup,
  Select,
  Separator,
  Skeleton,
  Slider,
  Stat,
  StatRow,
  Switch,
  Table,
  Tabs,
  Textarea,
  ToggleIconButton,
  type AlertRootProps,
  type BadgeProps,
  type BetaBadgeProps,
  type ButtonProps,
  type CheckboxProps,
  type CloseButtonProps,
  type IconButtonProps,
  type ImageProps,
  type LinkProps,
  type NumberInputProps,
  type PasswordInputProps,
  type RadioGroupProps,
  type RadioProps,
  type SelectOption,
  type SelectProps,
  type SeparatorProps,
  type SkeletonProps,
  type TextareaProps,
  type ToggleIconButtonProps,
} from '@marketmind/ui-core';

// Tier-2 (token-aware composed primitives) — stay app-side for now.
export { Callout } from './callout';
export type { CalloutTone } from './callout';
export { CreateActionButton, type CreateActionButtonProps } from './create-action-button';
export { ColorModeProvider, useColorMode } from './color-mode';
export { ColorPicker, DEFAULT_COLOR_PRESETS } from './color-picker';
export type { ColorPickerProps } from './color-picker';
export { DialogShell, type DialogShellProps, type DialogSize } from './dialog-shell';
export { DialogSection, type DialogSectionProps } from './dialog-section';
export { FormRow, FormSection } from './form-section';
export { MetricCard } from './MetricCard';
export { PanelHeader } from './panel-header';
export { PnLDisplay } from './PnLDisplay';
export { SidebarContainer, SidebarHeader } from './Sidebar';
export { TooltipWrapper } from './Tooltip';
export { FieldHint, MetaText, PageTitle, SectionDescription, SectionTitle, SubsectionTitle } from './typography';

// Tier-3 (i18n / runtime-coupled) — stay app-side indefinitely.
export { CollapsibleSection } from './CollapsibleSection';
export { ConfirmationDialog } from './ConfirmationDialog';
export { CryptoIcon } from './CryptoIcon';
export { DirectionModeSelector } from './DirectionModeSelector';
export type { DirectionMode } from './DirectionModeSelector';
export { EmptyState } from './EmptyState';
export { ErrorMessage } from './ErrorMessage';
export { FormDialog } from './FormDialog';
export { GridWindow } from './GridWindow';
export type { GridWindowState } from './GridWindow';
export { LoadingSpinner } from './LoadingSpinner';
export { PasswordStrengthMeter } from './PasswordStrengthMeter';
