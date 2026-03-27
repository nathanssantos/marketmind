import type { SVGProps } from 'react';

export const AnchoredVwapIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <circle cx="5" cy="16" r="2" />
    <line x1="5" y1="14" x2="5" y2="4" />
    <line x1="3" y1="6" x2="7" y2="6" />
    <path d="M7 16c3-4 6 2 9-2s4-4 5-5" />
  </svg>
);
