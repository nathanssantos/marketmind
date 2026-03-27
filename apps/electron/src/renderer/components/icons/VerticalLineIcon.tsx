import type { SVGProps } from 'react';

export const VerticalLineIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <line x1="12" y1="3" x2="12" y2="21" />
    <line x1="9" y1="3" x2="15" y2="3" />
    <line x1="9" y1="21" x2="15" y2="21" />
  </svg>
);
