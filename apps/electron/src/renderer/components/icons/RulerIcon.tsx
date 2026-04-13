import type { SVGProps } from 'react';

export const RulerIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <path d="M21.17 8.04 8.04 21.17a2 2 0 0 1-2.83 0L2.83 18.8a2 2 0 0 1 0-2.83L15.96 2.83a2 2 0 0 1 2.83 0l2.38 2.38a2 2 0 0 1 0 2.83Z" />
    <line x1="14.5" y1="4.5" x2="16" y2="6" />
    <line x1="11.5" y1="7.5" x2="14" y2="10" />
    <line x1="8.5" y1="10.5" x2="10" y2="12" />
    <line x1="5.5" y1="13.5" x2="8" y2="16" />
  </svg>
);
