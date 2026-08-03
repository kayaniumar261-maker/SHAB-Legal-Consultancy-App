import { supabase } from '../lib/supabase';

export type CompanySettings = {
  id: string;
  legal_name: string;
  registered_address: string | null;
  email: string | null;
  phone: string | null;
  tax_registration_number: string | null;
  bank_name: string | null;
  account_holder_name: string | null;
  account_number: string | null;
  iban: string | null;
  swift_bic: string | null;
  routing_code: string | null;
  account_currency: string;
  invoice_prefix: string;
  payment_instructions: string | null;
};

export async function getCompanySettings():
Promise<CompanySettings | null> {
  const result = await supabase
    .from('company_settings')
    .select(`
      id,
      legal_name,
      registered_address,
      email,
      phone,
      tax_registration_number,
      bank_name,
      account_holder_name,
      account_number,
      iban,
      swift_bic,
      routing_code,
      account_currency,
      invoice_prefix,
      payment_instructions
    `)
    .eq('id', 'primary')
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data as CompanySettings | null;
}
