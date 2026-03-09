import { Slider as ChakraSlider } from '@chakra-ui/react';

export interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  onValueChangeEnd?: (value: number[]) => void;
  min: number;
  max: number;
  step: number;
  width?: string;
  label?: string;
  showValue?: boolean;
}

export const Slider = (props: SliderProps) => {
  const { label, showValue = false, value, onValueChange, onValueChangeEnd, min, max, step, width = 'full' } = props;

  return (
    <ChakraSlider.Root value={value} onValueChange={(e) => onValueChange(e.value)} onValueChangeEnd={onValueChangeEnd ? (e) => onValueChangeEnd(e.value) : undefined} min={min} max={max} step={step} width={width}>
      {label && <ChakraSlider.Label>{label}</ChakraSlider.Label>}
      <ChakraSlider.Control>
        <ChakraSlider.Track>
          <ChakraSlider.Range />
        </ChakraSlider.Track>
        <ChakraSlider.Thumb index={0} />
      </ChakraSlider.Control>
      {showValue && <ChakraSlider.ValueText />}
    </ChakraSlider.Root>
  );
};
