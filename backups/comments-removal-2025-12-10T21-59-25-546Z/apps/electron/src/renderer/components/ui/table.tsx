import { Table as ChakraTable } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface TableRootProps {
    children: ReactNode;
    variant?: string;
    size?: string;
    [key: string]: unknown;
}

interface TableHeaderProps {
    children: ReactNode;
}

interface TableBodyProps {
    children: ReactNode;
}

interface TableRowProps {
    children: ReactNode;
}

interface TableColumnHeaderProps {
    children: ReactNode;
}

interface TableCellProps {
    children: ReactNode;
}

const TableRoot = ({ children, ...props }: TableRootProps) => (
    <ChakraTable.Root {...(props as any)}>
        {children}
    </ChakraTable.Root>
);

const TableHeader = ({ children }: TableHeaderProps) => (
    <ChakraTable.Header>
        {children}
    </ChakraTable.Header>
);

const TableBody = ({ children }: TableBodyProps) => (
    <ChakraTable.Body>
        {children}
    </ChakraTable.Body>
);

const TableRow = ({ children }: TableRowProps) => (
    <ChakraTable.Row>
        {children}
    </ChakraTable.Row>
);

const TableColumnHeader = ({ children }: TableColumnHeaderProps) => (
    <ChakraTable.ColumnHeader>
        {children}
    </ChakraTable.ColumnHeader>
);

const TableCell = ({ children }: TableCellProps) => (
    <ChakraTable.Cell>
        {children}
    </ChakraTable.Cell>
);

export const Table = {
    Root: TableRoot,
    Header: TableHeader,
    Body: TableBody,
    Row: TableRow,
    ColumnHeader: TableColumnHeader,
    Cell: TableCell,
};
