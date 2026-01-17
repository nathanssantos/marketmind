import Table from 'cli-table3';

export const TABLE_CHARS = {
  top: '-',
  'top-mid': '+',
  'top-left': '+',
  'top-right': '+',
  bottom: '-',
  'bottom-mid': '+',
  'bottom-left': '+',
  'bottom-right': '+',
  left: '|',
  'left-mid': '+',
  mid: '-',
  'mid-mid': '+',
  right: '|',
  'right-mid': '+',
  middle: '|',
} as const;

export interface TableOptions {
  head?: string[];
  colWidths?: number[];
  headColor?: string;
  borderColor?: string;
}

export const createTable = (options: TableOptions = {}): Table.Table => {
  const { head = [], colWidths, headColor = 'cyan', borderColor = 'gray' } = options;

  return new Table({
    head,
    colWidths,
    style: {
      head: [headColor],
      border: [borderColor],
    },
    chars: TABLE_CHARS,
  });
};

export { Table };
