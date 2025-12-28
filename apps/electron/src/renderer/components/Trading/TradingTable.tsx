import { Box } from '@chakra-ui/react';
import { Table } from '@renderer/components/ui/table';
import type { ReactNode } from 'react';

export interface TradingTableColumn {
  key: string;
  header: string;
  sticky?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  minW?: string;
}

interface TradingTableProps {
  columns: TradingTableColumn[];
  children: ReactNode;
  minW?: string;
}

const STICKY_STYLES = {
  position: 'sticky' as const,
  left: 0,
  zIndex: 1,
  bg: 'bg.panel',
  _dark: { bg: 'gray.800' },
  borderRight: '1px solid',
  borderColor: 'border.muted',
};

export const TradingTable = ({ columns, children, minW = '1200px' }: TradingTableProps) => {
  return (
    <Box overflowX="auto" maxW="100%">
      <Table.Root size="sm" minW={minW}>
        <Table.Header>
          <Table.Row>
            {columns.map((col) => (
              <Table.ColumnHeader
                key={col.key}
                {...(col.sticky ? STICKY_STYLES : {})}
                minW={col.minW}
                textAlign={col.textAlign}
                px={3}
                py={2}
                whiteSpace="nowrap"
                fontSize="xs"
                fontWeight="semibold"
                textTransform="uppercase"
                letterSpacing="wider"
                color="fg.muted"
              >
                {col.header}
              </Table.ColumnHeader>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>{children}</Table.Body>
      </Table.Root>
    </Box>
  );
};

interface TradingTableRowProps {
  children: ReactNode;
  onClick?: () => void;
}

export const TradingTableRow = ({ children, onClick }: TradingTableRowProps) => {
  return (
    <Table.Row
      _hover={{ bg: 'bg.muted' }}
      cursor={onClick ? 'pointer' : 'default'}
      onClick={onClick}
    >
      {children}
    </Table.Row>
  );
};

interface TradingTableCellProps {
  children: ReactNode;
  sticky?: boolean;
  textAlign?: 'left' | 'center' | 'right';
}

export const TradingTableCell = ({ children, sticky, textAlign }: TradingTableCellProps) => {
  return (
    <Table.Cell
      {...(sticky ? STICKY_STYLES : {})}
      textAlign={textAlign}
      px={3}
      py={2}
      whiteSpace="nowrap"
      fontSize="xs"
    >
      {children}
    </Table.Cell>
  );
};
