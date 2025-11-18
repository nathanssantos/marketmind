import { Box } from '@chakra-ui/react';
import { LuBrain } from 'react-icons/lu';
import { MdShowChart } from 'react-icons/md';

interface LogoProps {
  size?: number;
}

export const Logo = ({ size = 24 }: LogoProps) => {
  return (
    <Box position="relative" width={`${size}px`} height={`${size}px`}>
      <Box position="absolute" top={0} left={0} color="blue.500">
        <LuBrain size={size} />
      </Box>
      <Box position="absolute" top={0} left={0} color="green.400" opacity={0.85}>
        <MdShowChart size={size} />
      </Box>
    </Box>
  );
};
