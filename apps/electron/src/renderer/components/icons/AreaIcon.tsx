import type { SVGProps } from 'react';

export const AreaIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <rect x="4" y="4" width="16" height="16" strokeDasharray="4 2" />
    <line x1="4" y1="4" x2="7" y2="4" />
    <line x1="4" y1="4" x2="4" y2="7" />
    <line x1="20" y1="4" x2="20" y2="7" />
    <line x1="20" y1="20" x2="17" y2="20" />
    <line x1="20" y1="20" x2="20" y2="17" />
    <line x1="4" y1="20" x2="4" y2="17" />
  </svg>
);
