import { shabLogoUrl } from './branding';

export type CompanyProfile = {
  legalName: string;
  shortName: string;
  logoUrl: string;
  jurisdiction: string;
  defaultCurrency: string;
  registeredAddress: string;
  email: string;
  phone: string;
  taxRegistrationNumber: string;
};

export const companyProfile: CompanyProfile = {
  legalName: 'SHAB Legal Consultancy FZE',
  shortName: 'SHAB',
  logoUrl: shabLogoUrl,
  jurisdiction: 'United Arab Emirates',
  defaultCurrency: 'AED',

  // Add verified company details before issuing final documents.
  registeredAddress: '',
  email: '',
  phone: '',
  taxRegistrationNumber: '',
};
