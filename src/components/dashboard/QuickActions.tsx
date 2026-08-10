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
    title: 'New Client',
    icon: UserPlus,
    description: 'Register a new client',
    path: '/clients',
  },
  {
    title: 'New Case',
    icon: Scale,
    description: 'Open a legal matter',
    path: '/cases',
  },
  {
    title: 'Schedule Hearing',
    icon: CalendarPlus,
    description: 'Create hearing schedule',
    path: '/hearings',
  },
  {
    title: 'Upload Document',
    icon: FilePlus2,
    description: 'Store legal documents',
    path: '/documents',
  },
  {
    title: 'Create Invoice',
    icon: ReceiptText,
    description: 'Generate client invoice',
    path: '/payments',
  },
  {
    title: 'Add Task',
    icon: ClipboardPlus,
    description: 'Assign a new task',
    path: '/tasks',
  },
];

export function QuickActions({ isAdministrator }: { isAdministrator: boolean }) {
  const navigate =
    useNavigate();

  return (
    <section className="dashboard-panel quick-actions-panel">
      <div className="panel-heading-row">
        <div>
          <span className="section-tag">
            PRODUCTIVITY
          </span>

          <h3>Quick Actions</h3>

          <p>
            Launch common workflow steps instantly.
          </p>
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