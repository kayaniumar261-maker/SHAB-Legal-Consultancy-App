import type {
  AIMatterContext,
} from './aiContextService';

export type AIPromptBuildOptions = {
  includePrivateNotes?: boolean;
  maximumItemsPerSection?: number;
};

export function buildMatterPrompt(
  context: AIMatterContext,
  userRequest: string,
  options: AIPromptBuildOptions = {},
): string {
  const {
    includePrivateNotes = true,
    maximumItemsPerSection = 20,
  } = options;

  const caseRecord = context.caseRecord;

  const openTasks = context.tasks.filter(
    (task) =>
      normalize(task.status) !== 'completed',
  );

  const upcomingHearings = context.hearings
    .filter(
      (hearing) =>
        getTime(hearing.hearing_at) >= Date.now() &&
        !['completed', 'cancelled'].includes(
          normalize(hearing.status),
        ),
    )
    .sort(
      (first, second) =>
        getTime(first.hearing_at) -
        getTime(second.hearing_at),
    );

  const notes = context.notes.filter(
    (note) =>
      includePrivateNotes ||
      !note.is_private,
  );

  const outstandingInvoices =
    context.invoices.filter(
      (invoice) =>
        Number(
          invoice.balance_amount ?? 0,
        ) > 0,
    );

  const sections = [
    createSection('MATTER IDENTITY', [
      createLine(
        'Matter reference',
        caseRecord.matter_number ??
          caseRecord.case_number ??
          caseRecord.case_type,
      ),

      createLine(
        'Client',
        context.clientName,
      ),

      createLine(
        'Case type',
        caseRecord.case_type,
      ),

      createLine(
        'Status',
        formatLabel(caseRecord.status),
      ),

      createLine(
        'Priority',
        formatLabel(caseRecord.priority),
      ),

      createLine(
        'Risk level',
        formatLabel(caseRecord.risk_level),
      ),

      createLine(
        'Urgent action',
        caseRecord.requires_urgent_action
          ? 'Yes'
          : 'No',
      ),

      createLine(
        'Court',
        caseRecord.court,
      ),

      createLine(
        'Court case number',
        caseRecord.court_case_number,
      ),

      createLine(
        'Opponent',
        caseRecord.opponent_name,
      ),
    ]),

    createSection('MATTER NARRATIVE', [
      createLine(
        'Description',
        caseRecord.description,
      ),

      createLine(
        'Legal issues',
        caseRecord.legal_issues,
      ),

      createLine(
        'Next actions',
        caseRecord.next_actions,
      ),
    ]),

    createSection('KEY DATES', [
      createLine(
        'Opened',
        formatDate(
          caseRecord.opened_at ??
            caseRecord.filing_date,
        ),
      ),

      createLine(
        'Next hearing',
        formatDate(
          caseRecord.next_hearing_at,
        ),
      ),

      createLine(
        'Next action',
        formatDate(
          caseRecord.next_action_at,
        ),
      ),

      createLine(
        'Limitation date',
        formatDate(
          caseRecord.limitation_date,
        ),
      ),

      createLine(
        'Next follow-up',
        formatDate(
          caseRecord.next_follow_up_at,
        ),
      ),
    ]),

    createSection('FINANCIAL POSITION', [
      createLine(
        'Claim value',
        formatCurrency(
          caseRecord.claim_amount ??
            caseRecord.case_value,
          caseRecord.currency,
        ),
      ),

      createLine(
        'Recovered',
        formatCurrency(
          caseRecord.recovered_amount,
          caseRecord.currency,
        ),
      ),

      createLine(
        'Total billed',
        formatCurrency(
          caseRecord.total_billed,
          caseRecord.currency,
        ),
      ),

      createLine(
        'Outstanding case balance',
        formatCurrency(
          caseRecord.outstanding_balance,
          caseRecord.currency,
        ),
      ),

      createLine(
        'Invoice count',
        context.invoices.length,
      ),

      createLine(
        'Outstanding invoice count',
        outstandingInvoices.length,
      ),

      createLine(
        'Payment count',
        context.payments.length,
      ),
    ]),

    createListSection(
      'OPEN TASKS',
      openTasks
        .slice(
          0,
          maximumItemsPerSection,
        )
        .map(
          (task) =>
            [
              task.title,
              `Status: ${formatLabel(
                task.status,
              )}`,
              `Priority: ${formatLabel(
                task.priority,
              )}`,
              `Due: ${formatDate(
                task.due_at,
              )}`,
              task.description,
            ]
              .filter(Boolean)
              .join(' | '),
        ),
    ),

    createListSection(
      'UPCOMING HEARINGS',
      upcomingHearings
        .slice(
          0,
          maximumItemsPerSection,
        )
        .map(
          (hearing) =>
            [
              hearing.title,
              formatDate(
                hearing.hearing_at,
              ),
              hearing.court,
              hearing.courtroom,
              `Status: ${formatLabel(
                hearing.status,
              )}`,
            ]
              .filter(Boolean)
              .join(' | '),
        ),
    ),

    createListSection(
      'DOCUMENT REGISTER',
      context.documents
        .slice(
          0,
          maximumItemsPerSection,
        )
        .map(
          (documentRecord) =>
            [
              documentRecord.name,
              documentRecord.document_type,
              documentRecord.is_confidential
                ? 'Confidential'
                : null,
              formatDate(
                documentRecord.created_at,
              ),
            ]
              .filter(Boolean)
              .join(' | '),
        ),
    ),

    createListSection(
      'CASE NOTES',
      notes
        .slice(
          0,
          maximumItemsPerSection,
        )
        .map(
          (note) =>
            [
              note.is_pinned
                ? 'Pinned'
                : null,
              note.is_private
                ? 'Private'
                : null,
              formatDate(
                note.created_at,
              ),
              truncate(
                note.note,
                1000,
              ),
            ]
              .filter(Boolean)
              .join(' | '),
        ),
    ),

    createListSection(
      'RECENT ACTIVITIES',
      context.activities
        .slice(
          0,
          maximumItemsPerSection,
        )
        .map(
          (activity) =>
            [
              formatDate(
                activity.activity_at,
              ),
              activity.title,
              activity.description,
            ]
              .filter(Boolean)
              .join(' | '),
        ),
    ),

    createListSection(
      'STATUS HISTORY',
      context.statusHistory
        .slice(
          0,
          maximumItemsPerSection,
        )
        .map(
          (history) =>
            [
              formatDate(
                history.changed_at,
              ),
              `${formatLabel(
                history.previous_status,
              )} → ${formatLabel(
                history.new_status,
              )}`,
              history.change_reason,
            ]
              .filter(Boolean)
              .join(' | '),
        ),
    ),

    createListSection(
      'INVOICES',
      context.invoices
        .slice(
          0,
          maximumItemsPerSection,
        )
        .map(
          (invoice) =>
            [
              invoice.invoice_number,
              `Status: ${formatLabel(
                invoice.status,
              )}`,
              `Total: ${formatCurrency(
                invoice.total_amount,
                invoice.currency,
              )}`,
              `Balance: ${formatCurrency(
                invoice.balance_amount,
                invoice.currency,
              )}`,
              `Due: ${formatDate(
                invoice.due_date,
              )}`,
            ]
              .filter(Boolean)
              .join(' | '),
        ),
    ),

    createListSection(
      'PAYMENTS',
      context.payments
        .slice(
          0,
          maximumItemsPerSection,
        )
        .map(
          (payment) =>
            [
              formatDate(
                payment.payment_date,
              ),
              formatCurrency(
                payment.amount,
                payment.currency,
              ),
              payment.payment_method,
              payment.reference_number,
              `Status: ${formatLabel(
                payment.status,
              )}`,
            ]
              .filter(Boolean)
              .join(' | '),
        ),
    ),

    createSection('USER REQUEST', [
      userRequest.trim(),
    ]),

    createSection(
      'DRAFTING INSTRUCTIONS',
      [
        'Use only the supplied matter information.',
        'Do not invent facts, dates, documents, amounts, admissions, legal authorities, or procedural events.',
        'Clearly identify missing or uncertain information.',
        'Use a professional legal tone suitable for SHAB Legal Consultants FZC.',
        'Preserve confidentiality and distinguish internal notes from client-facing content.',
      ],
    ),
  ];

  return sections
    .filter(Boolean)
    .join('\n\n');
}

function createSection(
  title: string,
  lines: Array<
    string | null | undefined
  >,
): string {
  const content =
    lines.filter(Boolean);

  if (content.length === 0) {
    return '';
  }

  return [
    `## ${title}`,
    ...content,
  ].join('\n');
}

function createListSection(
  title: string,
  items: string[],
): string {
  if (items.length === 0) {
    return [
      `## ${title}`,
      'No records available.',
    ].join('\n');
  }

  return [
    `## ${title}`,
    ...items.map(
      (item) => `- ${item}`,
    ),
  ].join('\n');
}

function createLine(
  label: string,
  value: unknown,
): string | null {
  const text =
    String(value ?? '').trim();

  return text
    ? `${label}: ${text}`
    : null;
}

function normalize(
  value: unknown,
): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function formatLabel(
  value: unknown,
): string {
  const normalized =
    normalize(value);

  if (!normalized) {
    return 'Not specified';
  }

  return normalized
    .replace(/_/g, ' ')
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function formatDate(
  value:
    | string
    | null
    | undefined,
): string {
  if (!value) {
    return 'Not specified';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'en-AE',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(date);
}

function formatCurrency(
  value: unknown,
  currency:
    | string
    | null
    | undefined,
): string {
  return new Intl.NumberFormat(
    'en-AE',
    {
      style: 'currency',
      currency:
        currency || 'AED',
      maximumFractionDigits: 2,
    },
  ).format(
    Number(value ?? 0),
  );
}

function getTime(
  value:
    | string
    | null
    | undefined,
): number {
  if (!value) {
    return 0;
  }

  const time =
    new Date(value).getTime();

  return Number.isNaN(time)
    ? 0
    : time;
}

function truncate(
  value: string,
  maximumLength: number,
): string {
  if (
    value.length <=
    maximumLength
  ) {
    return value;
  }

  return `${value.slice(
    0,
    maximumLength,
  )}…`;
}
