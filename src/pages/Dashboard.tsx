import {
  AlertTriangle,
  BellRing,
  Briefcase,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  FileText,
  FolderOpen,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import { KPICard } from '../components/dashboard/KPICard';
import { QuickActions } from '../components/dashboard/QuickActions';
import { RecentCases } from '../components/dashboard/RecentCases';
import { UpcomingHearings } from '../components/dashboard/UpcomingHearings';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import { RecentDocuments } from '../components/dashboard/RecentDocuments';
import { TaskWidget } from '../components/dashboard/TaskWidget';
import { StaffWorkload } from '../components/dashboard/StaffWorkload';
import { RevenueChart } from '../components/dashboard/RevenueChart';
import { CaseDistribution } from '../components/dashboard/CaseDistribution';
import { CalendarWidget } from '../components/dashboard/CalendarWidget';
import { Notifications } from '../components/dashboard/Notifications';

import './Dashboard.css';

import {
  getDashboardSummary,
  type DashboardKPIData,
  type DashboardServiceError,
} from '../services/dashboardService';

type KPI = {
  label: string;
  value: string;
  subtitle: string;
  trend: string;
  trendPositive: boolean;
  icon: typeof Briefcase;
  to?: string;
};

const emptyDashboardData: DashboardKPIData = {
  activeCases: 0,
  totalClients: 0,
  hearingsToday: 0,
  tasksDueToday: 0,
  outstandingPayments: 0,
  monthlyRevenue: 0,
  collectionRate: 0,
  overdueInvoices: 0,
  overdueTasks: 0,
  hearingsTomorrow: 0,
  newClientsThisMonth: 0,
  documentsUploaded: 0,
  activeStaff: 0,
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLoadedTime(value: string | null): string {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('en-AE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function FinanceSummaryItem({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'success' | 'warning' | 'danger';
}) {
  return (
    <article
      className={`dashboard-finance-item ${tone}`}
    >
      <span>{label}</span>

      <strong>{value}</strong>

      <small>{detail}</small>
    </article>
  );
}

function ExecutiveAlert({
  label,
  value,
  formattedValue,
  message,
  clearMessage,
  to,
}: {
  label: string;
  value: number;
  formattedValue?: string;
  message: string;
  clearMessage: string;
  to: string;
}) {
  const hasAlert = value > 0;

  return (
    <a
      className={`executive-alert-card ${
        hasAlert ? 'warning' : 'clear'
      }`}
      href={to}
    >
      <div className="executive-alert-icon">
        {hasAlert ? (
          <AlertTriangle size={19} />
        ) : (
          <ShieldCheck size={19} />
        )}
      </div>

      <div>
        <span>{label}</span>

        <strong>
          {formattedValue ?? value}
        </strong>

        <p>
          {hasAlert ? message : clearMessage}
        </p>
      </div>
    </a>
  );
}

export function Dashboard() {
  const [dashboardData, setDashboardData] =
    useState<DashboardKPIData>(emptyDashboardData);

  const [dashboardErrors, setDashboardErrors] =
    useState<DashboardServiceError[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const summary = await getDashboardSummary();

        setDashboardData(summary.data);
        setDashboardErrors(summary.errors);
        setLoadedAt(summary.loadedAt);
      } catch (error) {
        console.error(
          'Unable to load dashboard summary:',
          error,
        );

        setDashboardErrors([
          {
            section: 'activeCases',
            message:
              error instanceof Error
                ? error.message
                : 'Unable to load dashboard.',
          },
        ]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const kpis = useMemo<KPI[]>(
    () => [
      {
        label: 'Active Cases',
        value: isLoading
          ? '—'
          : String(dashboardData.activeCases),
        subtitle: 'Open legal matters',
        trend: 'Live',
        trendPositive: true,
        icon: Briefcase,
      },
      {
        label: 'Total Clients',
        value: isLoading
          ? '—'
          : String(dashboardData.totalClients),
        subtitle: 'Managed relationships',
        trend: 'Live',
        trendPositive: true,
        icon: Users,
      },
      {
        label: 'Hearings Today',
        value: isLoading
          ? '—'
          : String(dashboardData.hearingsToday),
        subtitle: 'Court appearances today',
        trend:
          dashboardData.hearingsToday > 0
            ? 'Action'
            : 'Clear',
        trendPositive:
          dashboardData.hearingsToday === 0,
        icon: CalendarDays,
        to: '/hearings?date=today',
      },
      {
        label: 'Tasks Due Today',
        value: isLoading
          ? '—'
          : String(dashboardData.tasksDueToday),
        subtitle: 'Due before end of day',
        trend:
          dashboardData.tasksDueToday > 0
            ? 'Due'
            : 'Clear',
        trendPositive:
          dashboardData.tasksDueToday === 0,
        icon: ClipboardList,
        to: '/tasks?date=today',
      },
      {
        label: 'Outstanding Payments',
        value: isLoading
          ? '—'
          : formatCurrency(
              dashboardData.outstandingPayments,
            ),
        subtitle: 'Pending receivables',
        trend:
          dashboardData.outstandingPayments > 0
            ? 'Pending'
            : 'Clear',
        trendPositive:
          dashboardData.outstandingPayments === 0,
        icon: CreditCard,
      },
      {
        label: 'Monthly Revenue',
        value: isLoading
          ? '—'
          : formatCurrency(
              dashboardData.monthlyRevenue,
            ),
        subtitle: 'Collected this month',
        trend: 'Live',
        trendPositive: true,
        icon: ShieldCheck,
      },
      {
        label: 'Collection Rate',
        value: isLoading
          ? '—'
          : `${dashboardData.collectionRate.toFixed(0)}%`,
        subtitle: 'Collected against billed fees',
        trend:
          dashboardData.collectionRate >= 80
            ? 'Healthy'
            : 'Review',
        trendPositive:
          dashboardData.collectionRate >= 80,
        icon: CircleDollarSign,
        to: '/payments',
      },
      {
        label: 'Overdue Invoices',
        value: isLoading
          ? '—'
          : String(dashboardData.overdueInvoices),
        subtitle: 'Invoices requiring follow-up',
        trend:
          dashboardData.overdueInvoices > 0
            ? 'Action'
            : 'Clear',
        trendPositive:
          dashboardData.overdueInvoices === 0,
        icon: ReceiptText,
        to: '/payments',
      },
      {
        label: 'New Clients This Month',
        value: isLoading
          ? '—'
          : String(dashboardData.newClientsThisMonth),
        subtitle: 'New managed relationships',
        trend: 'Growth',
        trendPositive: true,
        icon: UserPlus,
        to: '/clients',
      },
      {
        label: 'Overdue Tasks',
        value: isLoading
          ? '—'
          : String(dashboardData.overdueTasks),
        subtitle: 'Tasks past their due date',
        trend:
          dashboardData.overdueTasks > 0
            ? 'Action'
            : 'Clear',
        trendPositive:
          dashboardData.overdueTasks === 0,
        icon: AlertTriangle,
        to: '/tasks',
      },
      {
        label: 'Documents Uploaded',
        value: isLoading
          ? '—'
          : String(
              dashboardData.documentsUploaded,
            ),
        subtitle: 'Stored case materials',
        trend: 'Live',
        trendPositive: true,
        icon: FileText,
      },
      {
        label: 'Active Staff',
        value: isLoading
          ? '—'
          : String(dashboardData.activeStaff),
        subtitle: 'Available team members',
        trend: 'Live',
        trendPositive: true,
        icon: FolderOpen,
      },
    ],
    [
      dashboardData,
      isLoading,
    ],
  );

  return (
    <div className="dashboard-page">
      <section className="dashboard-header">
        <div>
          <p className="page-eyebrow">
            Executive overview
          </p>

          <h2>SHAB Legal Consultancy</h2>

          <p className="page-intro">
            A centralized command centre for cases,
            clients, hearings, tasks, documents and
            financial performance.
          </p>
        </div>

        <div className="dashboard-header-actions">
          {loadedAt && (
            <span className="dashboard-updated-time">
              Updated {formatLoadedTime(loadedAt)}
            </span>
          )}

          <button
            type="button"
            className="dashboard-refresh-button"
            onClick={() => {
              void loadDashboard(true);
            }}
            disabled={isRefreshing}
          >
            <RefreshCw
              size={16}
              className={
                isRefreshing
                  ? 'dashboard-refresh-icon spinning'
                  : 'dashboard-refresh-icon'
              }
            />

            {isRefreshing
              ? 'Refreshing'
              : 'Refresh'}
          </button>
        </div>
      </section>

      {dashboardErrors.length > 0 && (
        <section
          className="dashboard-data-warning"
          role="status"
        >
          <strong>
            Some dashboard information could not be
            loaded.
          </strong>

          <span>
            The available sections are still displayed.
            Refresh the page after checking Supabase.
          </span>
        </section>
      )}

      <section className="kpi-grid">
        {kpis.slice(0, 8).map((item) => (
          <KPICard
            key={item.label}
            icon={item.icon}
            value={item.value}
            label={item.label}
            subtitle={item.subtitle}
            trend={item.trend}
            trendPositive={item.trendPositive}
            to={item.to}
          />
        ))}
      </section>

      <section className="executive-alerts-panel">
        <div className="executive-alerts-header">
          <div>
            <span className="page-eyebrow">
              Management attention
            </span>

            <h3>Executive Alerts</h3>

            <p>
              Operational and financial items requiring review.
            </p>
          </div>

          <BellRing size={22} />
        </div>

        <div className="executive-alerts-grid">
          <ExecutiveAlert
            label="Overdue invoices"
            value={dashboardData.overdueInvoices}
            message="Invoices require collection follow-up."
            to="/payments"
            clearMessage="No overdue invoices."
          />

          <ExecutiveAlert
            label="Overdue tasks"
            value={dashboardData.overdueTasks}
            message="Tasks are currently past their deadlines."
            to="/tasks"
            clearMessage="No overdue tasks."
          />

          <ExecutiveAlert
            label="Hearings tomorrow"
            value={dashboardData.hearingsTomorrow}
            message="Court appearances are scheduled tomorrow."
            to="/hearings"
            clearMessage="No hearings scheduled tomorrow."
          />

          <ExecutiveAlert
            label="Outstanding receivables"
            value={dashboardData.outstandingPayments}
            formattedValue={formatCurrency(
              dashboardData.outstandingPayments,
            )}
            message="Outstanding professional fees remain unpaid."
            to="/payments"
            clearMessage="No outstanding receivables."
          />
        </div>
      </section>

      <QuickActions />

      <section className="dashboard-finance-summary">
        <div className="dashboard-finance-heading">
          <div>
            <span className="page-eyebrow">
              Financial command centre
            </span>

            <h3>Executive Finance Summary</h3>

            <p>
              Current collections, receivables and invoice
              performance across the firm.
            </p>
          </div>

          <Link
            className="dashboard-finance-link"
            to="/payments"
          >
            Open Finance
          </Link>
        </div>

        <div className="dashboard-finance-grid">
          <FinanceSummaryItem
            label="Revenue This Month"
            value={
              isLoading
                ? '—'
                : formatCurrency(
                    dashboardData.monthlyRevenue,
                  )
            }
            detail="Completed collections"
            tone="success"
          />

          <FinanceSummaryItem
            label="Outstanding Receivables"
            value={
              isLoading
                ? '—'
                : formatCurrency(
                    dashboardData.outstandingPayments,
                  )
            }
            detail="Professional fees still unpaid"
            tone={
              dashboardData.outstandingPayments > 0
                ? 'warning'
                : 'success'
            }
          />

          <FinanceSummaryItem
            label="Collection Rate"
            value={
              isLoading
                ? '—'
                : `${dashboardData.collectionRate.toFixed(0)}%`
            }
            detail="Collected against total billed"
            tone={
              dashboardData.collectionRate >= 80
                ? 'success'
                : dashboardData.collectionRate >= 50
                  ? 'warning'
                  : 'danger'
            }
          />

          <FinanceSummaryItem
            label="Overdue Invoices"
            value={
              isLoading
                ? '—'
                : String(
                    dashboardData.overdueInvoices,
                  )
            }
            detail="Invoices requiring follow-up"
            tone={
              dashboardData.overdueInvoices > 0
                ? 'danger'
                : 'success'
            }
          />
        </div>

        <div className="dashboard-collection-progress">
          <div className="dashboard-collection-progress-head">
            <span>Collection performance</span>

            <strong>
              {isLoading
                ? '—'
                : `${dashboardData.collectionRate.toFixed(0)}%`}
            </strong>
          </div>

          <div className="dashboard-collection-track">
            <div
              className="dashboard-collection-value"
              style={{
                width: `${
                  isLoading
                    ? 0
                    : Math.min(
                        100,
                        Math.max(
                          0,
                          dashboardData.collectionRate,
                        ),
                      )
                }%`,
              }}
            />
          </div>
        </div>
      </section>

      <section className="dashboard-workspace">
        <div className="dashboard-work-row dashboard-work-row-primary">
          <RecentCases />

          <div className="dashboard-side-stack">
            <TaskWidget />
            <RevenueChart />
            <RecentDocuments />
          </div>
        </div>

        <div className="dashboard-work-row dashboard-work-row-secondary">
          <UpcomingHearings />

          <div className="dashboard-side-stack">
            <StaffWorkload />
            <CaseDistribution />
            <CalendarWidget />
          </div>
        </div>

        <div className="dashboard-work-row dashboard-work-row-bottom">
          <ActivityFeed />
          <Notifications />
        </div>
      </section>
    </div>
  );
}