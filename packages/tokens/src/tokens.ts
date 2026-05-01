/**
 * MarketMind compact-style design tokens.
 *
 * Source of truth for spacing + typography across every primitive
 * (FormSection / FormRow / Callout / typography). Mirrors the table in
 * `docs/archive/V1_POST_RELEASE_PLAN.md` § Design language.
 *
 * Why tokens instead of literals:
 * - Single change point when the density target shifts
 * - Documents intent (`mm.spacing.section.gap` is a meaningful unit)
 * - Kept in pure TS so primitives can consume directly without going
 *   through Chakra's token resolver — avoids polymorphic-typing pain
 *   we hit during v1.0.0 (see PR #203 history)
 *
 * The values are Chakra-spacing-scale-compatible (numbers map to
 * `0.25rem * n`), so passing them as `gap={MM.spacing.section.gap}`
 * works inline without translation.
 */

export const MM = {
  spacing: {
    /** Between sections in a dialog or tab — matches VSCode density. */
    section: { gap: 4 }, // 16px

    /** Between rows inside a section. */
    row: { gap: 2.5 }, // 10px

    /** Inline groups (icon + label, badges, etc). */
    inline: { gap: 1.5 }, // 6px

    /** Compact inline (Callout compact mode). */
    inlineTight: { gap: 1 }, // 4px

    /** Dialog body padding. */
    dialogPadding: 3, // 12px

    /** Section content padding. */
    sectionPadding: 2.5, // 10px

    /** Compact callout padding. */
    calloutCompact: { px: 2.5, py: 1.5 },

    /** Default callout padding. */
    callout: { px: 3, py: 2.5 },
  },

  font: {
    pageTitle: { size: 'lg' as const, weight: 'bold' as const },
    sectionTitle: { size: 'sm' as const, weight: 'semibold' as const },
    subsection: { size: '2xs' as const, weight: 'bold' as const },
    body: { size: 'xs' as const, weight: 'normal' as const },
    hint: { size: '2xs' as const, weight: 'normal' as const },
  },

  lineHeight: {
    title: 1.2,
    body: 1.45,
    hint: 1.4,
  },

  buttonSize: {
    primary: 'xs' as const,
    secondary: '2xs' as const,
    /** Tiny pagination/navigation buttons (prev/next, etc.) */
    nav: '2xs' as const,
  },

  /**
   * Spinners shown as the loading state of a dashboard-style panel
   * (PerformancePanel, EquityCurveChart, PerformanceCalendar, etc.).
   * Vertical padding ensures the spinner sits at a consistent height
   * before the panel's first paint.
   */
  spinner: {
    panel: { size: 'md' as const, py: 6 },
    inline: { size: 'sm' as const, py: 0 },
  },

  borderRadius: {
    badge: 'sm' as const,
    card: 'md' as const,
  },

  // Avatar / preview sizing.
  preview: {
    sm: 48,
    md: 64,
  },

  /**
   * Dialog (a.k.a. modal) primitive sizing + structural spacing.
   * Read by <DialogShell> and <DialogSection>; consumed directly by
   * any dialog-adjacent surface (drawers, full-screen panels) so they
   * agree on width and inner padding without one-off literals.
   *
   * Sizes:
   * - sm: confirmation / single-field (~400px)
   * - md: standard form (~560px)
   * - lg: data viewer or 2-column form (~840px)
   * - xl: workflow modal with tabs (~1100px)
   * - full: fullscreen (100vw)
   *
   * v1.6 Track A.3.
   */
  dialog: {
    size: {
      sm: { maxW: '400px' },
      md: { maxW: '560px' },
      lg: { maxW: '840px' },
      xl: { maxW: '1100px', w: '90vw' },
      full: { maxW: '100vw', w: '100vw' },
    },
    bodyPadding: 4, // 16px
    headerPadding: { x: 4, top: 4, bottom: 3 }, // 16/16/12px
    footerPadding: { x: 4, y: 3 }, // 16/12px
    sectionGap: 4, // gap between <DialogSection>s inside the body
  },

  typography: {
    /** Modal/dialog title. One size, one weight. */
    dialogTitle: { fontSize: 'md' as const, fontWeight: 'semibold' as const, lineHeight: 'short' as const },
    /** Optional one-line description below the title. */
    dialogDescription: { fontSize: 'xs' as const, color: 'fg.muted', lineHeight: 'tall' as const },
    /** Section heading inside a dialog body. */
    sectionTitle: { fontSize: 'sm' as const, fontWeight: 'semibold' as const },
    /** Section helper text. */
    sectionDescription: { fontSize: '2xs' as const, color: 'fg.muted', lineHeight: 'tall' as const },
  },
} as const;

export type MMTokens = typeof MM;
