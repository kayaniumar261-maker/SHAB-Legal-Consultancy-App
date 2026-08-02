import { supabase } from '../lib/supabase';

import type {
  ClientInsert,
} from './clientService';

import type {
  ImportRow,
} from '../types/import';

import {
  getMappedValue,
  normaliseClientStatus,
  normaliseText,
  type ImportFieldMapping,
} from './importMappingService';

export type ClientDuplicateReason =
  | 'legacy_client_id'
  | 'email'
  | 'phone'
  | 'emirates_id'
  | 'passport_number'
  | 'trade_license_number'
  | 'full_name';

export type ClientImportPreparedRow = {
  rowNumber: number;
  sourceRow: ImportRow;
  client: ClientInsert;
};

export type ClientImportDuplicate = {
  rowNumber: number;
  clientName: string;
  reason: ClientDuplicateReason;
  matchedValue: string;
  existingClientId?: string;
  existingClientName?: string;
  source:
    | 'database'
    | 'workbook';
};

export type ClientImportScanResult = {
  preparedRows: ClientImportPreparedRow[];
  newRows: ClientImportPreparedRow[];
  duplicates: ClientImportDuplicate[];
};

export type ClientImportFailure = {
  rowNumber: number;
  clientName: string;
  message: string;
};

export type ClientImportProgress = {
  current: number;
  total: number;
  percentage: number;
  rowNumber: number;
  clientName: string;
};

export type ClientImportResult = {
  processed: number;
  imported: number;
  skipped: number;
  failed: number;
  failures: ClientImportFailure[];
};

type ExistingClientRecord = {
  id: string;
  full_name: string;
  legacy_client_id: string | null;
  email: string | null;
  phone: string | null;
  emirates_id: string | null;
  passport_number: string | null;
  trade_license_number: string | null;
};
export function prepareClientImportRows(
  rows: ImportRow[],
  mapping: ImportFieldMapping,
  sourceFileName: string,
): ClientImportPreparedRow[] {
  const importedAt =
    new Date().toISOString();

  return rows.map(
    (row, index) => {
      const fullName =
        normaliseText(
          getMappedValue(
            row,
            mapping,
            'full_name',
          ),
        );

      const companyName =
        nullableText(
          getMappedValue(
            row,
            mapping,
            'company_name',
          ),
        );

      const explicitType =
        normaliseText(
          getMappedValue(
            row,
            mapping,
            'client_type',
          ),
        ).toLowerCase();

      const clientType:
        ClientInsert['client_type'] =
          explicitType.includes(
            'company',
          ) ||
          explicitType.includes(
            'corporate',
          ) ||
          Boolean(companyName)
            ? 'company'
            : 'individual';

      const client: ClientInsert = {
        full_name: fullName,
        client_type: clientType,
        email: nullableText(
          getMappedValue(
            row,
            mapping,
            'email',
          ),
        ),
        phone: nullableText(
          getMappedValue(
            row,
            mapping,
            'phone',
          ),
        ),
        nationality: nullableText(
          getMappedValue(
            row,
            mapping,
            'nationality',
          ),
        ),
        emirates_id: nullableText(
          getMappedValue(
            row,
            mapping,
            'emirates_id',
          ),
        ),
        passport_number: nullableText(
          getMappedValue(
            row,
            mapping,
            'passport_number',
          ),
        ),
        company_name: companyName,
        trade_license_number:
          nullableText(
            getMappedValue(
              row,
              mapping,
              'trade_license_number',
            ),
          ),
        address: nullableText(
          getMappedValue(
            row,
            mapping,
            'address',
          ),
        ),
        notes: nullableText(
          getMappedValue(
            row,
            mapping,
            'notes',
          ),
        ),
        status:
          normaliseClientStatus(
            getMappedValue(
              row,
              mapping,
              'status',
            ),
          ),
        legacy_client_id:
          nullableText(
            getMappedValue(
              row,
              mapping,
              'legacy_client_id',
            ),
          ),
        imported_from:
          sourceFileName,
        imported_at:
          importedAt,
      };

      return {
        rowNumber:
          index + 2,
        sourceRow: row,
        client,
      };
    },
  );
}

function nullableText(
  value: unknown,
): string | null {
  const text =
    String(
      value ?? '',
    ).trim();

  return text || null;
}
export async function scanClientImportDuplicates(
  preparedRows: ClientImportPreparedRow[],
): Promise<ClientImportScanResult> {
  const existingClients =
    await loadExistingClients();

  const duplicates:
    ClientImportDuplicate[] = [];

  const duplicateRowNumbers =
    new Set<number>();

  const workbookIndexes = {
    legacy_client_id:
      new Map<string, ClientImportPreparedRow>(),
    email:
      new Map<string, ClientImportPreparedRow>(),
    phone:
      new Map<string, ClientImportPreparedRow>(),
    emirates_id:
      new Map<string, ClientImportPreparedRow>(),
    passport_number:
      new Map<string, ClientImportPreparedRow>(),
    trade_license_number:
      new Map<string, ClientImportPreparedRow>(),
    full_name:
      new Map<string, ClientImportPreparedRow>(),
  };

  for (const row of preparedRows) {
    const databaseDuplicate =
      findDatabaseDuplicate(
        row,
        existingClients,
      );

    if (databaseDuplicate) {
      duplicates.push(
        databaseDuplicate,
      );

      duplicateRowNumbers.add(
        row.rowNumber,
      );

      continue;
    }

    const workbookDuplicate =
      findWorkbookDuplicate(
        row,
        workbookIndexes,
      );

    if (workbookDuplicate) {
      duplicates.push(
        workbookDuplicate,
      );

      duplicateRowNumbers.add(
        row.rowNumber,
      );

      continue;
    }

    addToWorkbookIndexes(
      row,
      workbookIndexes,
    );
  }

  return {
    preparedRows,
    newRows:
      preparedRows.filter(
        (row) =>
          !duplicateRowNumbers.has(
            row.rowNumber,
          ),
      ),
    duplicates,
  };
}

async function loadExistingClients(): Promise<
  ExistingClientRecord[]
> {
  const result = await supabase
    .from('clients')
    .select(
      `
        id,
        full_name,
        legacy_client_id,
        email,
        phone,
        emirates_id,
        passport_number,
        trade_license_number
      `,
    );

  if (result.error) {
    throw new Error(
      result.error.message,
    );
  }

  return (
    result.data ?? []
  ) as ExistingClientRecord[];
}

function findDatabaseDuplicate(
  row: ClientImportPreparedRow,
  existingClients:
    ExistingClientRecord[],
): ClientImportDuplicate | null {
  for (
    const existing of
    existingClients
  ) {
    const match =
      compareClientIdentity(
        row.client,
        existing,
      );

    if (!match) {
      continue;
    }

    return {
      rowNumber:
        row.rowNumber,
      clientName:
        row.client.full_name,
      reason:
        match.reason,
      matchedValue:
        match.value,
      existingClientId:
        existing.id,
      existingClientName:
        existing.full_name,
      source: 'database',
    };
  }

  return null;
}
function findWorkbookDuplicate(
  row: ClientImportPreparedRow,
  indexes: Record<
    ClientDuplicateReason,
    Map<string, ClientImportPreparedRow>
  >,
): ClientImportDuplicate | null {
  const checks: Array<{
    reason: ClientDuplicateReason;
    value: string | null | undefined;
  }> = [
    {
      reason: 'legacy_client_id',
      value: row.client.legacy_client_id,
    },
    {
      reason: 'email',
      value: row.client.email,
    },
    {
      reason: 'phone',
      value: row.client.phone,
    },
    {
      reason: 'emirates_id',
      value: row.client.emirates_id,
    },
    {
      reason: 'passport_number',
      value: row.client.passport_number,
    },
    {
      reason: 'trade_license_number',
      value: row.client.trade_license_number,
    },
    {
      reason: 'full_name',
      value: row.client.full_name,
    },
  ];

  for (const check of checks) {
    const key = normalizeKey(check.value);

    if (!key) {
      continue;
    }

    const existing = indexes[
      check.reason
    ].get(key);

    if (!existing) {
      continue;
    }

    return {
      rowNumber: row.rowNumber,
      clientName: row.client.full_name,
      reason: check.reason,
      matchedValue: key,
      existingClientName:
        existing.client.full_name,
      source: 'workbook',
    };
  }

  return null;
}

function addToWorkbookIndexes(
  row: ClientImportPreparedRow,
  indexes: Record<
    ClientDuplicateReason,
    Map<string, ClientImportPreparedRow>
  >,
): void {
  const values: Array<[
    ClientDuplicateReason,
    string | null | undefined,
  ]> = [
    [
      'legacy_client_id',
      row.client.legacy_client_id,
    ],
    ['email', row.client.email],
    ['phone', row.client.phone],
    [
      'emirates_id',
      row.client.emirates_id,
    ],
    [
      'passport_number',
      row.client.passport_number,
    ],
    [
      'trade_license_number',
      row.client.trade_license_number,
    ],
    [
      'full_name',
      row.client.full_name,
    ],
  ];

  for (const [reason, value] of values) {
    const key = normalizeKey(value);

    if (!key) {
      continue;
    }

    indexes[reason].set(
      key,
      row,
    );
  }
}
function compareClientIdentity(
  client: ClientInsert,
  existing: ExistingClientRecord,
):
  | {
      reason: ClientDuplicateReason;
      value: string;
    }
  | null {
  const comparisons: Array<[
    ClientDuplicateReason,
    string | null | undefined,
    string | null | undefined,
  ]> = [
    [
      'legacy_client_id',
      client.legacy_client_id,
      existing.legacy_client_id,
    ],
    [
      'email',
      client.email,
      existing.email,
    ],
    [
      'phone',
      client.phone,
      existing.phone,
    ],
    [
      'emirates_id',
      client.emirates_id,
      existing.emirates_id,
    ],
    [
      'passport_number',
      client.passport_number,
      existing.passport_number,
    ],
    [
      'trade_license_number',
      client.trade_license_number,
      existing.trade_license_number,
    ],
    [
      'full_name',
      client.full_name,
      existing.full_name,
    ],
  ];

  for (const [reason, left, right] of comparisons) {
    const a = normalizeKey(left);
    const b = normalizeKey(right);

    if (a && b && a === b) {
      return {
        reason,
        value: a,
      };
    }
  }

  return null;
}

function normalizeKey(
  value: string | null | undefined,
): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export async function importClients(
  rows: ClientImportPreparedRow[],
  onProgress?: (
    progress: ClientImportProgress,
  ) => void,
): Promise<ClientImportResult> {
  const failures: ClientImportFailure[] = [];
  let imported = 0;

  for (
    let index = 0;
    index < rows.length;
    index += 1
  ) {
    const row = rows[index];

    if (!row) {
      continue;
    }

    const result = await supabase
      .from('clients')
      .insert(row.client);

    if (result.error) {
      failures.push({
        rowNumber: row.rowNumber,
        clientName: row.client.full_name,
        message: result.error.message,
      });
    } else {
      imported += 1;
    }

    const current = index + 1;

    onProgress?.({
      current,
      total: rows.length,
      percentage:
        rows.length > 0
          ? Math.round(
              (current / rows.length) * 100,
            )
          : 100,
      rowNumber: row.rowNumber,
      clientName: row.client.full_name,
    });
  }

  return {
    processed: rows.length,
    imported,
    skipped: 0,
    failed: failures.length,
    failures,
  };
}
