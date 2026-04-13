import type { SVGProps } from 'react';

export const ChannelIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <line x1="4" y1="18" x2="18" y2="4" />
    <line x1="6" y1="22" x2="20" y2="8" />
  </svg>
);
