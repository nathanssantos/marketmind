import type { SVGProps } from 'react';

export const PencilIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <path d="M3 20l1.5-4.5L17 3l3 3L7.5 18.5z" />
    <path d="M14 6l3 3" />
  </svg>
);
