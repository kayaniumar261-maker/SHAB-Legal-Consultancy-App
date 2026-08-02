import type {
  ImportCellValue,
  ImportEntityType,
  ImportRow,
} from '../types/import';

export type ImportFieldDefinition = {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
};

export type ImportFieldMapping = Record<
  string,
  string
>;

export type ImportValidationIssue = {
  rowNumber: number;
  field: string;
  message: string;
};

export type ImportValidationResult = {
  validRows: number;
  invalidRows: number;
  issues: ImportValidationIssue[];
};

const clientFields: ImportFieldDefinition[] = [
  {
    key: 'legacy_client_id',
    label: 'Legacy client ID',
    required: false,
    aliases: [
      'client id',
      'legacy client id',
      'client code',
      'customer id',
      'customer code',
    ],
  },
  {
    key: 'full_name',
    label: 'Full name',
    required: true,
    aliases: [
      'client name',
      'full name',
      'name',
      'customer name',
    ],
  },
  {
    key: 'client_type',
    label: 'Client type',
    required: false,
    aliases: [
      'client type',
      'type',
    ],
  },
  {
    key: 'email',
    label: 'Email',
    required: false,
    aliases: [
      'email',
      'email address',
    ],
  },
  {
    key: 'phone',
    label: 'Phone',
    required: false,
    aliases: [
      'phone',
      'phone number',
      'mobile',
      'contact number',
    ],
  },
  {
    key: 'nationality',
    label: 'Nationality',
    required: false,
    aliases: [
      'nationality',
      'country',
    ],
  },
  {
    key: 'emirates_id',
    label: 'Emirates ID',
    required: false,
    aliases: [
      'emirates id',
      'eid',
      'emirates id number',
    ],
  },
  {
    key: 'passport_number',
    label: 'Passport number',
    required: false,
    aliases: [
      'passport number',
      'passport',
      'id/passport number',
      'id passport number',
    ],
  },
  {
    key: 'company_name',
    label: 'Company name',
    required: false,
    aliases: [
      'company',
      'company name',
      'organisation',
      'organization',
    ],
  },
  {
    key: 'trade_license_number',
    label: 'Trade licence number',
    required: false,
    aliases: [
      'trade license number',
      'trade licence number',
      'license number',
    ],
  },
  {
    key: 'address',
    label: 'Address',
    required: false,
    aliases: [
      'address',
      'location',
    ],
  },
  {
    key: 'notes',
    label: 'Notes',
    required: false,
    aliases: [
      'notes',
      'remarks',
      'description',
    ],
  },
  {
    key: 'status',
    label: 'Status',
    required: false,
    aliases: [
      'status',
      'client status',
    ],
  },
];
const caseFields: ImportFieldDefinition[] = [
  {
    key: 'client_name',
    label: 'Client name',
    required: true,
    aliases: [
      'client name',
      'customer name',
      'client',
    ],
  },
  {
    key: 'case_number',
    label: 'Case number',
    required: false,
    aliases: [
      'case number',
      'matter number',
      'case no',
      'case no.',
    ],
  },
  {
    key: 'case_type',
    label: 'Case type',
    required: true,
    aliases: [
      'case type',
      'matter type',
      'practice area',
    ],
  },
  {
    key: 'court',
    label: 'Court',
    required: false,
    aliases: [
      'court',
      'court name',
    ],
  },
  {
    key: 'jurisdiction',
    label: 'Jurisdiction',
    required: false,
    aliases: [
      'jurisdiction',
    ],
  },
  {
    key: 'opponent_name',
    label: 'Opponent party',
    required: false,
    aliases: [
      'opponent party',
      'opponent',
      'opposing party',
      'defendant',
    ],
  },
  {
    key: 'responsible_lawyer_name',
    label: 'Assigned lawyer',
    required: false,
    aliases: [
      'assigned lawyer',
      'responsible lawyer',
      'lawyer',
    ],
  },
  {
    key: 'status',
    label: 'Case status',
    required: false,
    aliases: [
      'case status',
      'status',
    ],
  },
  {
    key: 'filing_date',
    label: 'Date opened',
    required: false,
    aliases: [
      'date opened',
      'filing date',
      'opened date',
    ],
  },
  {
    key: 'closed_at',
    label: 'Date closed',
    required: false,
    aliases: [
      'date closed',
      'closed date',
    ],
  },
  {
    key: 'case_value',
    label: 'Case value',
    required: false,
    aliases: [
      'case value',
      'claim amount',
      'matter value',
    ],
  },
  {
    key: 'description',
    label: 'Description',
    required: false,
    aliases: [
      'description/remarks',
      'description',
      'remarks',
      'case description',
    ],
  },
];
export function getImportFields(
  entityType: ImportEntityType,
): ImportFieldDefinition[] {
  return entityType === 'clients'
    ? clientFields
    : caseFields;
}

export function createAutomaticMapping(
  headers: string[],
  entityType: ImportEntityType,
): ImportFieldMapping {
  const fields = getImportFields(entityType);

  return fields.reduce<ImportFieldMapping>(
    (mapping, field) => {
      const matchedHeader = headers.find(
        (header) =>
          field.aliases.some(
            (alias) =>
              normaliseHeader(header) ===
              normaliseHeader(alias),
          ),
      );

      mapping[field.key] =
        matchedHeader ?? '';

      return mapping;
    },
    {},
  );
}

export function getMappedValue(
  row: ImportRow,
  mapping: ImportFieldMapping,
  field: string,
): ImportCellValue {
  const sourceHeader = mapping[field];

  if (!sourceHeader) {
    return null;
  }

  return row[sourceHeader] ?? null;
}

export function normaliseText(
  value: ImportCellValue,
): string {
  return String(value ?? '').trim();
}

function normaliseHeader(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\/_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function hasValue(
  value: ImportCellValue,
): boolean {
  return (
    value !== null &&
    value !== undefined &&
    String(value).trim() !== ''
  );
}
export function validateMappedRows(
  rows: ImportRow[],
  entityType: ImportEntityType,
  mapping: ImportFieldMapping,
): ImportValidationResult {
  const fields = getImportFields(entityType);
  const issues: ImportValidationIssue[] = [];

  rows.forEach((row, index) => {
    fields
      .filter((field) => field.required)
      .forEach((field) => {
        const value = getMappedValue(
          row,
          mapping,
          field.key,
        );

        if (!hasValue(value)) {
          issues.push({
            rowNumber: index + 2,
            field: field.label,
            message: `${field.label} is required.`,
          });
        }
      });

    if (entityType === 'clients') {
      validateClientRow(
        row,
        index,
        mapping,
        issues,
      );
    }

    if (entityType === 'cases') {
      validateCaseRow(
        row,
        index,
        mapping,
        issues,
      );
    }
  });

  const invalidRows = new Set(
    issues.map(
      (issue) => issue.rowNumber,
    ),
  );

  return {
    validRows:
      rows.length -
      invalidRows.size,

    invalidRows:
      invalidRows.size,

    issues,
  };
}

export function normaliseClientStatus(
  value: ImportCellValue,
): 'active' | 'inactive' | 'prospect' {
  const status =
    normaliseText(value)
      .toLowerCase();

  if (
    status === 'inactive' ||
    status === 'closed'
  ) {
    return 'inactive';
  }

  if (
    status === 'pending' ||
    status === 'prospect' ||
    status === 'lead'
  ) {
    return 'prospect';
  }

  return 'active';
}

export function normaliseCaseStatus(
  value: ImportCellValue,
):
  | 'open'
  | 'pending'
  | 'in_court'
  | 'closed'
  | 'appeal' {
  const status =
    normaliseText(value)
      .toLowerCase();

  if (
    status.includes('closed') ||
    status.includes('complete')
  ) {
    return 'closed';
  }

  if (
    status.includes('appeal')
  ) {
    return 'appeal';
  }

  if (
    status.includes('court') ||
    status.includes('execution') ||
    status === 'active'
  ) {
    return 'in_court';
  }

  if (
    status.includes('pending') ||
    status.includes('hold')
  ) {
    return 'pending';
  }

  return 'open';
}

function validateClientRow(
  row: ImportRow,
  index: number,
  mapping: ImportFieldMapping,
  issues: ImportValidationIssue[],
) {
  const email = normaliseText(
    getMappedValue(
      row,
      mapping,
      'email',
    ),
  );

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    issues.push({
      rowNumber: index + 2,
      field: 'Email',
      message:
        'Email address is invalid.',
    });
  }
}

function validateCaseRow(
  row: ImportRow,
  index: number,
  mapping: ImportFieldMapping,
  issues: ImportValidationIssue[],
) {
  const caseValue = normaliseText(
    getMappedValue(
      row,
      mapping,
      'case_value',
    ),
  );

  if (
    caseValue &&
    Number.isNaN(
      Number(
        caseValue.replace(/,/g, ''),
      ),
    )
  ) {
    issues.push({
      rowNumber: index + 2,
      field: 'Case value',
      message:
        'Case value must be numeric.',
    });
  }
}
