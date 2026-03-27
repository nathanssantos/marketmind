import type { SVGProps } from 'react';

export const RayIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <circle cx="5" cy="19" r="1.5" />
    <line x1="6.5" y1="17.5" x2="21" y2="3" />
    <polyline points="16 3 21 3 21 8" />
  </svg>
);
