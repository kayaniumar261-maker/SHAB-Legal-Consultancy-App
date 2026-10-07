import type { Hearing } from '../types/hearing';

export function getHearingCaseReference(hearing: Hearing): string {
  return hearing.case?.court_case_number?.trim()
    || hearing.case?.case_number?.trim()
    || hearing.case?.matter_number?.trim()
    || 'Case reference unavailable';
}
