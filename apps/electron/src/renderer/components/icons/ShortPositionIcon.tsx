import type { SVGProps } from 'react';

export const ShortPositionIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <line x1="4" y1="10" x2="20" y2="10" />
    <line x1="4" y1="4" x2="20" y2="4" strokeOpacity={0.5} />
    <line x1="4" y1="18" x2="20" y2="18" strokeOpacity={0.5} />
    <polyline points="12 14 12 22 15 19" />
    <line x1="12" y1="22" x2="9" y2="19" />
  </svg>
);
