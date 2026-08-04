import {
  FinancialLedger,
} from '../finance/FinancialLedger';

type CaseBillingWorkspaceProps = {
  caseId: string;
};

export function CaseBillingWorkspace({
  caseId,
}: CaseBillingWorkspaceProps) {
  return (
    <FinancialLedger
      caseId={caseId}
      title="Case Financial Ledger"
      description="Complete invoice, collection, credit-note and payment-reversal history for this legal matter."
    />
  );
}
