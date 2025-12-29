import { Box, Flex } from '@chakra-ui/react';
import { Table } from '@renderer/components/ui/table';
import type { ReactNode } from 'react';
import { LuArrowDown, LuArrowUp, LuArrowUpDown } from 'react-icons/lu';

export interface TradingTableColumn {
  key: string;
  header: string;
  sticky?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  minW?: string;
  sortable?: boolean;
}

export type SortDirection = 'asc' | 'desc' | null;

interface TradingTableProps {
  columns: TradingTableColumn[];
  children: ReactNode;
  minW?: string;
  sortKey?: string | null;
  sortDirection?: SortDirection;
  onSort?: (key: string) => void;
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

export const TradingTable = ({ columns, children, minW = '1200px', sortKey, sortDirection, onSort }: TradingTableProps) => {
  return (
    <Box overflowX="auto" maxW="100%">
      <Table.Root size="sm" minW={minW}>
        <Table.Header>
          <Table.Row>
            {columns.map((col) => {
              const isSortable = col.sortable !== false && onSort;
              const isActive = sortKey === col.key;

              return (
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
                  color={isActive ? 'fg' : 'fg.muted'}
                  cursor={isSortable ? 'pointer' : 'default'}
                  userSelect="none"
                  _hover={isSortable ? { color: 'fg', bg: 'bg.muted' } : undefined}
                  onClick={isSortable ? () => onSort(col.key) : undefined}
                >
                  <Flex
                    align="center"
                    gap={1}
                    w="100%"
                    justify={isSortable ? 'space-between' : col.textAlign === 'right' ? 'flex-end' : col.textAlign === 'center' ? 'center' : 'flex-start'}
                  >
                    <Box flex={col.textAlign === 'right' ? 1 : undefined} textAlign={col.textAlign}>
                      {col.header}
                    </Box>
                    {isSortable && (
                      <Box opacity={isActive ? 1 : 0.3} fontSize="xs" flexShrink={0}>
                        {isActive && sortDirection === 'asc' ? (
                          <LuArrowUp size={12} />
                        ) : isActive && sortDirection === 'desc' ? (
                          <LuArrowDown size={12} />
                        ) : (
                          <LuArrowUpDown size={12} />
                        )}
                      </Box>
                    )}
                  </Flex>
                </Table.ColumnHeader>
              );
            })}
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
