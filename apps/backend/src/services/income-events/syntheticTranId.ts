let counter = 0;

export const nextSyntheticTranId = (): number => {
  counter += 1;
  return -(Date.now() * 1000 + counter);
};

export const isSyntheticTranId = (tranId: number): boolean => tranId < 0;
