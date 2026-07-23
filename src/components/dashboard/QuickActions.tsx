const actions = [
  'New Client',
  'New Case',
  'Schedule Hearing',
  'Upload Document',
  'Create Invoice',
  'Add Task',
];

export function QuickActions() {
  return (
    <section className="dashboard-panel quick-actions-panel">
      <div className="panel-heading-row">
        <div>
          <h3>Quick Actions</h3>
          <p>Launch the most common workflow steps instantly.</p>
        </div>
      </div>

      <div className="quick-actions-grid">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            className="quick-action-button"
          >
            {action}
          </button>
        ))}
      </div>
    </section>
  );
}
