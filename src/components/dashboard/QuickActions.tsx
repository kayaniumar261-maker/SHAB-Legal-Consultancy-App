import { tr, useLocale } from '../../i18n/locale';
import {
  CalendarPlus,
  ClipboardPlus,
  FilePlus2,
  ReceiptText,
  Scale,
  UserPlus,
} from 'lucide-react';

import {
  useNavigate,
} from 'react-router-dom';

import './QuickActions.css';

const actions = [
  {
    get title() { return tr("New Client"); },
    icon: UserPlus,
    get description() { return tr("Register a new client"); },
    path: '/clients',
  },
  {
    get title() { return tr("New Case"); },
    icon: Scale,
    get description() { return tr("Open a legal matter"); },
    path: '/cases',
  },
  {
    get title() { return tr("Schedule Hearing"); },
    icon: CalendarPlus,
    get description() { return tr("Create hearing schedule"); },
    path: '/hearings',
  },
  {
    get title() { return tr("Upload Document"); },
    icon: FilePlus2,
    get description() { return tr("Store legal documents"); },
    path: '/documents',
  },
  {
    get title() { return tr("Create Invoice"); },
    icon: ReceiptText,
    get description() { return tr("Generate client invoice"); },
    path: '/payments',
  },
  {
    get title() { return tr("Add Task"); },
    icon: ClipboardPlus,
    get description() { return tr("Assign a new task"); },
    path: '/tasks',
  },
];

export function QuickActions({ isAdministrator }: { isAdministrator: boolean }) {
  const interfaceLanguage = useLocale();
  const navigate =
    useNavigate();

  return (
    <section className="dashboard-panel quick-actions-panel">
      <div className="panel-heading-row">
        <div>
          <span className="section-tag">{tr("PRODUCTIVITY")}</span>

          <h3>{tr("Quick Actions")}</h3>

          <p>{tr("Launch common workflow steps instantly.")}</p>
        </div>
      </div>

      <div className="quick-actions-grid">
        {actions.filter((action) => isAdministrator || action.path !== '/payments').map((action) => {
          const Icon =
            action.icon;

          return (
            <button
              key={action.title}
              type="button"
              className="quick-action-button"
              onClick={() => {
                navigate(action.path);
              }}
            >
              <div className="quick-action-icon">
                <Icon size={18} />
              </div>

              <div className="quick-action-content">
                <span>
                  {action.title}
                </span>

                <small>
                  {action.description}
                </small>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}