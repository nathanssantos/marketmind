export const ANIMATION = {
  FADE_IN: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },
  SLIDE_IN_RIGHT: {
    initial: { x: 50, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 50, opacity: 0 },
    transition: { duration: 0.3 },
  },
  SLIDE_IN_LEFT: {
    initial: { x: -50, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -50, opacity: 0 },
    transition: { duration: 0.3 },
  },
  SLIDE_IN_UP: {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 20, opacity: 0 },
    transition: { duration: 0.3 },
  },
  SCALE_IN: {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.95, opacity: 0 },
    transition: { duration: 0.2 },
  },
} as const;

export const SPRING = {
  SMOOTH: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
  },
  BOUNCY: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 25,
  },
  STIFF: {
    type: 'spring' as const,
    stiffness: 500,
    damping: 35,
  },
} as const;
