import type { SVGProps } from 'react';

export const LongPositionIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="4" y1="14" x2="20" y2="14" />
    <line x1="4" y1="20" x2="20" y2="20" strokeOpacity={0.5} />
    <line x1="4" y1="6" x2="20" y2="6" strokeOpacity={0.5} />
    <polyline points="12 10 12 2 15 5" />
    <line x1="12" y1="2" x2="9" y2="5" />
  </svg>
);
