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
    <line x1="4" y1="20" x2="20" y2="4" />
    <line x1="7" y1="17" x2="9" y2="15" />
    <line x1="11" y1="13" x2="13" y2="11" />
    <line x1="15" y1="9" x2="17" y2="7" />
  </svg>
);
