import { tr, useLocale } from '../i18n/locale';
import {
  Construction,
} from 'lucide-react';

type PlaceholderPageProps = {
  title: string;
};

export function PlaceholderPage({
  title,
}: PlaceholderPageProps) {
  const interfaceLanguage = useLocale();
  return (
    <div className="page-container">
      <section className="page-heading">
        <div>
          <p className="page-eyebrow">{tr("SHAB Legal Consultants FZC")}</p>

          <h2>{title}</h2>

          <p>{tr("This module is prepared and will be developed in the next stage.")}</p>
        </div>
      </section>

      <section className="panel placeholder-panel">
        <Construction size={46} />

        <h3>{title}{" "}{tr("Module")}</h3>

        <p>{tr("The foundation is ready. We will add complete functionality, storage, validation, search, and reporting here.")}</p>
      </section>
    </div>
  );
}
