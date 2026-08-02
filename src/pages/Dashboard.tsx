import {
  Briefcase,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  FolderOpen,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { KPICard } from '../components/dashboard/KPICard';
import { QuickActions } from '../components/dashboard/QuickActions';
import { RecentCases } from '../components/dashboard/RecentCases';
import { UpcomingHearings } from '../components/dashboard/UpcomingHearings';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import { RecentDocuments } from '../components/dashboard/RecentDocuments';
import { TaskWidget } from '../components/dashboard/TaskWidget';
import { RevenueChart } from '../components/dashboard/RevenueChart';
import { CaseDistribution } from '../components/dashboard/CaseDistribution';
import { CalendarWidget } from '../components/dashboard/CalendarWidget';
import { Notifications } from '../components/dashboard/Notifications';

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
        {kpis.map((item) => (
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

      <QuickActions />

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