// Tier-1 + Tier-2 primitives extracted into @marketmind/ui-core
// (v1.6 Track B.1 + B.2). Re-exported here so existing app-site imports
// (`@renderer/components/ui`) keep working without per-callsite churn.
export {
  Alert,
  Badge,
  BetaBadge,
  Button,
  Callout,
  Card,
  Checkbox,
  CloseButton,
  ColorPicker,
  CreateActionButton,
  DataCard,
  DEFAULT_COLOR_PRESETS,
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
  DialogSection,
  DialogTitle,
  Field,
  FieldHint,
  FormRow,
  FormSection,
  IconButton,
  Image,
  Input,
  Link,
  Logo,
  Menu,
  MetaText,
  NumberInput,
  PageTitle,
  PanelHeader,
  PasswordInput,
  Popover,
  ProgressBar,
  ProgressRoot,
  Radio,
  RadioGroup,
  SectionDescription,
  SectionTitle,
  Select,
  Separator,
  SidebarContainer,
  SidebarHeader,
  Skeleton,
  Slider,
  Stat,
  StatRow,
  SubsectionTitle,
  Switch,
  Table,
  Tabs,
  Textarea,
  ToggleIconButton,
  type AlertRootProps,
  type BadgeProps,
  type BetaBadgeProps,
  type ButtonProps,
  type CalloutTone,
  type CheckboxProps,
  type CloseButtonProps,
  type ColorPickerProps,
  type CreateActionButtonProps,
  type DialogSectionProps,
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

// Stays app-side — i18n / runtime-coupled (Tier 3).
export { ColorModeProvider, useColorMode } from './color-mode';
export { CollapsibleSection } from './CollapsibleSection';
export { ConfirmationDialog } from './ConfirmationDialog';
export { CryptoIcon } from './CryptoIcon';
export { DialogShell, type DialogShellProps, type DialogSize } from './dialog-shell';
export { DirectionModeSelector } from './DirectionModeSelector';
export type { DirectionMode } from './DirectionModeSelector';
export { EmptyState } from './EmptyState';
export { ErrorMessage } from './ErrorMessage';
export { FormDialog } from './FormDialog';
export { GridWindow } from './GridWindow';
export type { GridWindowState } from './GridWindow';
export { LoadingSpinner } from './LoadingSpinner';
export { MetricCard } from './MetricCard';
export { PasswordStrengthMeter } from './PasswordStrengthMeter';
export { PnLDisplay } from './PnLDisplay';
export { TooltipWrapper } from './Tooltip';
