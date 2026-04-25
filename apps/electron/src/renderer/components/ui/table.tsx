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
     
    <ChakraTable.Root {...(props)}>{children}</ChakraTable.Root>
);

const TableHeader = ({ children, ...props }: TableComponentProps) => (
     
    <ChakraTable.Header {...(props)}>{children}</ChakraTable.Header>
);

const TableBody = ({ children, ...props }: TableComponentProps) => (
     
    <ChakraTable.Body {...(props)}>{children}</ChakraTable.Body>
);

const TableRow = ({ children, ...props }: TableComponentProps) => (
     
    <ChakraTable.Row {...(props)}>{children}</ChakraTable.Row>
);

const TableColumnHeader = ({ children, ...props }: TableComponentProps) => (
     
    <ChakraTable.ColumnHeader {...(props)}>{children}</ChakraTable.ColumnHeader>
);

const TableCell = ({ children, ...props }: TableComponentProps) => (
     
    <ChakraTable.Cell {...(props)}>{children}</ChakraTable.Cell>
);

export const Table = {
    Root: TableRoot,
    Header: TableHeader,
    Body: TableBody,
    Row: TableRow,
    ColumnHeader: TableColumnHeader,
    Cell: TableCell,
};
