import * as XLSX from 'xlsx';

import type {
  ImportCellValue,
  ImportRow,
  ImportWorkbook,
  ImportWorkbookSheet,
} from '../types/import';

const MAX_PREVIEW_ROWS = 5000;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export async function readImportWorkbook(
  file: File,
): Promise<ImportWorkbook> {
  validateFile(file);

  const buffer = await file.arrayBuffer();

  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    raw: false,
  });

  if (workbook.SheetNames.length === 0) {
    throw new Error(
      'The workbook does not contain any sheets.',
    );
  }

  const sheets = workbook.SheetNames
    .map((sheetName) =>
      parseSheet(workbook, sheetName),
    )
    .filter(
      (sheet) =>
        sheet.headers.length > 0 &&
        sheet.totalRows > 0,
    );

  if (sheets.length === 0) {
    throw new Error(
      'No readable data was found in the selected file.',
    );
  }

  return {
    fileName: file.name,
    sheets,
  };
}

function parseSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
): ImportWorkbookSheet {
  const worksheet =
    workbook.Sheets[sheetName];

  if (!worksheet) {
    return {
      name: sheetName,
      headers: [],
      rows: [],
      totalRows: 0,
    };
  }

  const matrix =
    XLSX.utils.sheet_to_json<unknown[]>(
      worksheet,
      {
        header: 1,
        defval: '',
        raw: false,
        blankrows: false,
      },
    );

  if (matrix.length === 0) {
    return {
      name: sheetName,
      headers: [],
      rows: [],
      totalRows: 0,
    };
  }

  const headers = createUniqueHeaders(
    matrix[0] ?? [],
  );

  const populatedRows = matrix
    .slice(1)
    .filter((row) =>
      row.some(
        (cell) =>
          String(cell ?? '').trim() !== '',
      ),
    );

  return {
    name: sheetName,
    headers,
    rows: populatedRows
      .slice(0, MAX_PREVIEW_ROWS)
      .map((row) =>
        rowToObject(headers, row),
      ),
    totalRows: populatedRows.length,
  };
}

function createUniqueHeaders(
  rawHeaders: unknown[],
): string[] {
  const used = new Map<string, number>();

  return rawHeaders.map(
    (value, index) => {
      const base =
        String(value ?? '').trim() ||
        `Column ${index + 1}`;

      const count = used.get(base) ?? 0;

      used.set(base, count + 1);

      return count === 0
        ? base
        : `${base} ${count + 1}`;
    },
  );
}

function rowToObject(
  headers: string[],
  row: unknown[],
): ImportRow {
  return headers.reduce<ImportRow>(
    (record, header, index) => {
      record[header] =
        normaliseCellValue(row[index]);

      return record;
    },
    {},
  );
}

function normaliseCellValue(
  value: unknown,
): ImportCellValue {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function validateFile(file: File): void {
  const extension = file.name
    .split('.')
    .pop()
    ?.toLowerCase();

  if (
    !['xlsx', 'xls', 'csv'].includes(
      extension ?? '',
    )
  ) {
    throw new Error(
      'Please upload an XLSX, XLS or CSV file.',
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      'The file exceeds the 25 MB import limit.',
    );
  }
}
