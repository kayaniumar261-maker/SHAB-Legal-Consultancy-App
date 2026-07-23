import type { LucideIcon } from 'lucide-react';

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
      <div className="kpi-card-icon">
        <Icon size={20} />
      </div>

      <div className="kpi-card-content">
        <span className="kpi-card-value">{value}</span>
        <p className="kpi-card-label">{label}</p>
      </div>

      <div className="kpi-card-footer">
        <span>{subtitle}</span>
        <span
          className={
            trendPositive
              ? 'kpi-trend positive'
              : 'kpi-trend negative'
          }
        >
          {trend}
        </span>
      </div>
    </article>
  );
}
