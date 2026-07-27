import type { LucideIcon } from 'lucide-react';
import './KPICard.css';

type KPICardProps = {
  icon: LucideIcon;
  value: string;
  label: string;
  subtitle: string;
  trend: string;
  trendPositive: boolean;
};

export function KPICard({
  icon: Icon,
  value,
  label,
  subtitle,
  trend,
  trendPositive,
}: KPICardProps) {
  return (
    <article className="kpi-card">
      <div className="kpi-card-accent" />

      <div className="kpi-card-top">
        <div className="kpi-card-icon">
          <Icon size={24} strokeWidth={2} />
        </div>

        <span
          className={`kpi-trend ${trendPositive ? 'positive' : 'negative'}`}
        >
          {trend}
        </span>
      </div>

      <div className="kpi-card-body">
        <h2 className="kpi-card-value">{value}</h2>
        <p className="kpi-card-label">{label}</p>
      </div>

      <div className="kpi-card-divider" />

      <div className="kpi-card-footer">
        <span>{subtitle}</span>
      </div>
    </article>
  );
}