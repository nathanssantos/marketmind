import type { SVGProps } from 'react';

export const HighlighterIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <path d="M18 2l4 4-9.5 9.5-4-4z" />
    <path d="M8.5 15.5L4 20h5l1-2" />
    <line x1="14" y1="6" x2="18" y2="10" />
  </svg>
);
