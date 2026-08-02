export type ImportEntityType =
  | 'clients'
  | 'cases';

export type ImportCellValue =
  | string
  | number
  | boolean
  | null;

export type ImportRow = Record<
  string,
  ImportCellValue
>;

export type ImportWorkbookSheet = {
  name: string;
  headers: string[];
  rows: ImportRow[];
  totalRows: number;
};

export type ImportWorkbook = {
  fileName: string;
  sheets: ImportWorkbookSheet[];
};
