const distribution = [
  { label: 'Civil', value: 28 },
  { label: 'Criminal', value: 18 },
  { label: 'Labour', value: 16 },
  { label: 'Corporate', value: 20 },
  { label: 'Family', value: 12 },
  { label: 'Arbitration', value: 6 },
];

export function CaseDistribution() {
  return (
    <section className="dashboard-panel case-distribution-panel">
      <div className="panel-heading-row">
        <div>
          <h3>Case Distribution</h3>
          <p>Portfolio by practice area.</p>
        </div>
      </div>

      <div className="distribution-body">
        <div className="pie-placeholder">
          <span>Pie chart placeholder</span>
        </div>

        <div className="distribution-legend">
          {distribution.map((item) => (
            <div
              key={item.label}
              className="distribution-row"
            >
              <span className="distribution-badge" />
              <span>{item.label}</span>
              <strong>{item.value}%</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
