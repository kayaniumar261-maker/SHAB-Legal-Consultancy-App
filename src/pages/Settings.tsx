import { tr, useLocale } from '../i18n/locale';
import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, ReceiptText, Save, ShieldCheck } from 'lucide-react';

import { getCompanySettings } from '../services/companySettingsService';
import { updateTaxSettings } from '../services/vatAccountingService';

import './Settings.css';

type TaxForm = {
  vatRegistered: boolean;
  trn: string;
  defaultVatRate: string;
  effectiveDate: string;
};

const EMPTY_FORM: TaxForm = {
  vatRegistered: false,
  trn: '',
  defaultVatRate: '0',
  effectiveDate: '',
};

export function Settings() {
  const interfaceLanguage = useLocale();
  const [form, setForm] = useState<TaxForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const settings = await getCompanySettings();
        if (settings) {
          setForm({
            vatRegistered: settings.vat_registered,
            trn: settings.tax_registration_number ?? '',
            defaultVatRate: String(settings.vat_registered ? settings.default_vat_rate : 0),
            effectiveDate: settings.vat_effective_date ?? '',
          });
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load company tax settings.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const normalizedTrn = form.trn.replace(/\D/g, '');
  const registrationReady = normalizedTrn.length === 15 && Boolean(form.effectiveDate);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (form.vatRegistered && !registrationReady) {
      setError('Enter the 15-digit FTA TRN and VAT effective date before enabling VAT.');
      return;
    }

    setSaving(true);
    try {
      await updateTaxSettings({
        vatRegistered: form.vatRegistered,
        taxRegistrationNumber: form.vatRegistered ? normalizedTrn : null,
        defaultVatRate: form.vatRegistered ? Number(form.defaultVatRate) : 0,
        vatEffectiveDate: form.vatRegistered ? form.effectiveDate : null,
      });
      setSuccess(form.vatRegistered
        ? 'VAT registration settings saved. Tax controls apply from the effective date.'
        : 'Unregistered mode saved. New invoices cannot charge or display VAT.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save VAT settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="settings-page">
      <section className="settings-heading">
        <div>
          <p className="page-eyebrow">{tr("Company controls")}</p>
          <h1>{tr("Settings")}</h1>
          <p>{tr("Manage SHAB's tax identity and protect invoice compliance.")}</p>
        </div>
        <div className={`vat-status-badge ${form.vatRegistered ? 'registered' : 'unregistered'}`}>
          {form.vatRegistered ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
          {form.vatRegistered ? tr("VAT Registered") : tr("Not VAT Registered")}
        </div>
      </section>

      {error ? <div className="settings-alert error"><AlertTriangle size={18} />{tr(error)}</div> : null}
      {success ? <div className="settings-alert success"><CheckCircle2 size={18} />{tr(success)}</div> : null}

      <section className="settings-grid">
        <form className="settings-card" onSubmit={handleSubmit}>
          <header>
            <div className="settings-icon"><ReceiptText size={22} /></div>
            <div>
              <h2>{tr("VAT registration")}</h2>
              <p>{tr("Enable only after FTA approval and confirmation of the effective date.")}</p>
            </div>
          </header>

          {loading ? <p className="settings-loading">{tr("Loading tax settings…")}</p> : (
            <div className="settings-fields">
              <label className="settings-toggle-row">
                <div>
                  <strong>{tr("Company is VAT registered")}</strong>
                  <span>{tr("Activates VAT and Tax Invoice controls.")}</span>
                </div>
                <input
                  type="checkbox"
                  checked={form.vatRegistered}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    vatRegistered: event.target.checked,
                    defaultVatRate: event.target.checked ? '5' : '0',
                    trn: event.target.checked ? current.trn : '',
                    effectiveDate: event.target.checked ? current.effectiveDate : '',
                  }))}
                />
              </label>

              <label>
                <span>{tr("FTA Tax Registration Number (TRN)")}</span>
                <input dir="auto"
                  inputMode="numeric"
                  maxLength={15}
                  placeholder={tr("15-digit TRN")}
                  value={form.trn}
                  disabled={!form.vatRegistered}
                  onChange={(event) => setForm((current) => ({ ...current, trn: event.target.value.replace(/\D/g, '').slice(0, 15) }))}
                />
                <small>{normalizedTrn.length}{tr("/15 digits")}</small>
              </label>

              <div className="settings-two-columns">
                <label>
                  <span>{tr("Default VAT rate")}</span>
                  <div className="settings-input-suffix">
                    <input dir="ltr"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={form.defaultVatRate}
                      disabled={!form.vatRegistered}
                      onChange={(event) => setForm((current) => ({ ...current, defaultVatRate: event.target.value }))}
                    />
                    <b>%</b>
                  </div>
                </label>

                <label>
                  <span>{tr("FTA effective date")}</span>
                  <input dir="ltr"
                    type="date"
                    value={form.effectiveDate}
                    disabled={!form.vatRegistered}
                    onChange={(event) => setForm((current) => ({ ...current, effectiveDate: event.target.value }))}
                  />
                </label>
              </div>

              <button type="submit" className="primary-action-button settings-save" disabled={saving || loading}>
                <Save size={17} />{saving ? tr("Saving…") : tr("Save VAT Settings")}
              </button>
            </div>
          )}
        </form>

        <aside className="settings-card compliance-card">
          <header>
            <div className="settings-icon safe"><ShieldCheck size={22} /></div>
            <div><h2>{tr("Current safeguards")}</h2><p>{tr("Applied to every new invoice.")}</p></div>
          </header>
          <ul>
            <li><CheckCircle2 size={17} /><span>{tr("Unregistered mode forces new invoices to Out of Scope with 0% VAT.")}</span></li>
            <li><CheckCircle2 size={17} /><span>{tr("Tax Invoice labeling stays disabled without a valid TRN.")}</span></li>
            <li><CheckCircle2 size={17} /><span>{tr("VAT is rejected before the FTA effective registration date.")}</span></li>
            <li><CheckCircle2 size={17} /><span>{tr("Historical documents are preserved and not recalculated.")}</span></li>
          </ul>
          {!form.vatRegistered ? (
            <div className="registration-note">
              <strong>{tr("Registration pending")}</strong>
              <p>{tr("Leave this mode active until the FTA approves SHAB's VAT application.")}</p>
            </div>
          ) : null}
        </aside>

      </section>
    </main>
  );
}
