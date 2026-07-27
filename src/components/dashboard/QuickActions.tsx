import './QuickActions.css';

const actions = [
  {
    title: 'New Client',
    icon: '👤',
    description: 'Register a new client',
  },
  {
    title: 'New Case',
    icon: '⚖️',
    description: 'Open a legal matter',
  },
  {
    title: 'Schedule Hearing',
    icon: '📅',
    description: 'Create hearing schedule',
  },
  {
    title: 'Upload Document',
    icon: '📄',
    description: 'Store legal documents',
  },
  {
    title: 'Create Invoice',
    icon: '💳',
    description: 'Generate client invoice',
  },
  {
    title: 'Add Task',
    icon: '✅',
    description: 'Assign a new task',
  },
];

export function QuickActions() {
  return (
    <section className="dashboard-panel quick-actions-panel">
      <div className="panel-heading-row">
        <div>
          <span className="section-tag">PRODUCTIVITY</span>
          <h3>Quick Actions</h3>
          <p>Launch the most common workflow steps instantly.</p>
        </div>
      </div>

      <div className="quick-actions-grid">
        {actions.map((action) => (
          <button
            key={action.title}
            type="button"
            className="quick-action-button"
          >
            <div className="quick-action-icon">
              {action.icon}
            </div>

            <div className="quick-action-content">
              <span>{action.title}</span>
              <small>{action.description}</small>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}