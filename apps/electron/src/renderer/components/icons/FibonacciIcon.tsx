import type { SVGProps } from 'react';

export const FibonacciIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <polyline points="4 20 4 4 20 20" />
    <line x1="4" y1="10" x2="14" y2="20" />
    <line x1="4" y1="15" x2="9" y2="20" />
  </svg>
);
