import { Box } from '@chakra-ui/react';
import { LuBrain } from 'react-icons/lu';
import { MdShowChart } from 'react-icons/md';

interface LogoProps {
  size?: number;
}

export const Logo = ({ size = 24 }: LogoProps) => {
  return (
    <Box position="relative" width={`${size}px`} height={`${size}px`}>
      <Box position="absolute" top={0} left={0} color="brand.logo.primary">
        <LuBrain size={size} />
      </Box>
      <Box position="absolute" top={0} left={0} color="brand.logo.secondary" opacity={0.85}>
        <MdShowChart size={size} />
      </Box>
    </Box>
  );
};
