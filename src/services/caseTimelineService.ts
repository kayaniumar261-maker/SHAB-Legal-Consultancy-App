import {
  supabase,
} from '../lib/supabase';

export type CaseTimelineEventInput = {
  caseId: string | null | undefined;
  activityType: string;
  title: string;
  description?: string | null;
  activityAt?: string;
  createdBy?: string | null;
};

/**
 * Adds an item to the legal matter timeline.
 *
 * Timeline logging is intentionally non-blocking:
 * a logging failure must never prevent the underlying
 * task, hearing, document, invoice, or payment operation.
 */
export async function logCaseTimelineEvent(
  input: CaseTimelineEventInput,
): Promise<void> {
  if (!input.caseId) {
    return;
  }

  try {
    let createdBy =
      input.createdBy ?? null;

    if (!createdBy) {
      const authResult =
        await supabase.auth.getUser();

      createdBy =
        authResult.data.user?.id ??
        null;
    }

    const result = await supabase
      .from('case_activities')
      .insert({
        case_id: input.caseId,
        activity_type:
          input.activityType,
        title: input.title,
        description:
          input.description?.trim() ||
          null,
        activity_at:
          input.activityAt ??
          new Date().toISOString(),
        created_by: createdBy,
      });

    if (result.error) {
      console.warn(
        '[Case Timeline] Unable to record activity:',
        result.error.message,
      );
    }
  } catch (error) {
    console.warn(
      '[Case Timeline] Activity logging failed:',
      error,
    );
  }
}

export function formatTimelineLabel(
  value: unknown,
): string {
  const normalized =
    String(value ?? '')
      .trim()
      .replace(/_/g, ' ')
      .toLowerCase();

  if (!normalized) {
    return 'Not specified';
  }

  return normalized.replace(
    /\b\w/g,
    (letter) =>
      letter.toUpperCase(),
  );
}

export function formatTimelineDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'No due date';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'No due date';
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
