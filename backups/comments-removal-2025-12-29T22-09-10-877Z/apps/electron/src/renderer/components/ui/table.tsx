import { Table as ChakraTable } from '@chakra-ui/react';
import type { ReactNode } from 'react';

interface TableRootProps {
    children: ReactNode;
    [key: string]: unknown;
}

interface TableComponentProps {
    children: ReactNode;
    [key: string]: unknown;
}

const TableRoot = ({ children, ...props }: TableRootProps) => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ChakraTable.Root {...(props as any)}>{children}</ChakraTable.Root>
);

const TableHeader = ({ children, ...props }: TableComponentProps) => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ChakraTable.Header {...(props as any)}>{children}</ChakraTable.Header>
);

const TableBody = ({ children, ...props }: TableComponentProps) => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ChakraTable.Body {...(props as any)}>{children}</ChakraTable.Body>
);

const TableRow = ({ children, ...props }: TableComponentProps) => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ChakraTable.Row {...(props as any)}>{children}</ChakraTable.Row>
);

const TableColumnHeader = ({ children, ...props }: TableComponentProps) => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ChakraTable.ColumnHeader {...(props as any)}>{children}</ChakraTable.ColumnHeader>
);

const TableCell = ({ children, ...props }: TableComponentProps) => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ChakraTable.Cell {...(props as any)}>{children}</ChakraTable.Cell>
);

export const Table = {
    Root: TableRoot,
    Header: TableHeader,
    Body: TableBody,
    Row: TableRow,
    ColumnHeader: TableColumnHeader,
    Cell: TableCell,
};
