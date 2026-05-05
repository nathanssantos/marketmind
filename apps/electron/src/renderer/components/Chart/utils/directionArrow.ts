export const getDirectionArrow = (isLong: boolean, flipped: boolean): '▲' | '▼' => {
  if (isLong) return flipped ? '▼' : '▲';
  return flipped ? '▲' : '▼';
};
