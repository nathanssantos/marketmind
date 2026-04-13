import type { SVGProps } from 'react';

export const GannFanIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <line x1="3" y1="21" x2="21" y2="3" />
    <line x1="3" y1="21" x2="21" y2="9" />
    <line x1="3" y1="21" x2="21" y2="15" />
    <line x1="3" y1="21" x2="15" y2="3" />
  </svg>
);
