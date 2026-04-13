import type { SVGProps } from 'react';

export const PriceRangeIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="18" x2="20" y2="18" />
    <line x1="12" y1="6" x2="12" y2="18" />
    <polyline points="9 9 12 6 15 9" />
    <polyline points="9 15 12 18 15 15" />
  </svg>
);
