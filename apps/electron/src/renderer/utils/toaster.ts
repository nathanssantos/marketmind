import { createToaster } from '@chakra-ui/react';

export const toaster = createToaster({
  placement: 'top-end',
  pauseOnPageIdle: true,
  max: 5,
  overlap: true,
  gap: 16,
  offsets: {
    top: '80px',
    right: '16px',
    bottom: '16px',
    left: '16px',
  },
});
