import {
  Briefcase,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  FolderOpen,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { KPICard } from '../components/dashboard/KPICard';
import { QuickActions } from '../components/dashboard/QuickActions';
import { RecentCases } from '../components/dashboard/RecentCases';
import { UpcomingHearings } from '../components/dashboard/UpcomingHearings';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import { TaskWidget } from '../components/dashboard/TaskWidget';
import { RevenueChart } from '../components/dashboard/RevenueChart';
import { CaseDistribution } from '../components/dashboard/CaseDistribution';
import { CalendarWidget } from '../components/dashboard/CalendarWidget';
import { Notifications } from '../components/dashboard/Notifications';

import { useEffect, useState } from 'react';
import { countStaff } from '../services/staffService';
import { countDocuments } from '../services/documentService';
import { getHearingsToday } from '../services/hearingService';
import { getTasksForToday } from '../services/taskService';
import { getOutstandingInvoicesAmount } from '../services/invoiceService';
import { getRevenueForMonth } from '../services/paymentService';
import { getClients } from '../services/clientService';
import { getCases } from '../services/caseService';

type KPI = {
  label: string;
  value: string;
  subtitle: string;
  trend: string;
  trendPositive: boolean;
  icon: any;
};

const kpiInitial: KPI[] = [];

export function Dashboard() {
  const [kpis, setKpis] = useState<KPI[]>(kpiInitial);

  useEffect(() => {
    async function load() {
      try {
        const clients = await getClients({ pageSize: 1 });
        const cases = await getCases({ pageSize: 1 });
        const hearingsToday = await getHearingsToday();
        const tasksToday = await getTasksForToday();
        const docsCount = await countDocuments();
        const staffCount = await countStaff();
        const outstanding = await getOutstandingInvoicesAmount();
        const now = new Date();
        const revenue = await getRevenueForMonth(now.getFullYear(), now.getMonth() + 1);

        setKpis([
          {
            label: 'Active Cases',
            value: String(cases.count ?? 0),
            subtitle: 'Live matters',
            trend: '+0%',
            trendPositive: true,
            icon: Briefcase,
          },
          {
            label: 'Total Clients',
            value: String(clients.count ?? 0),
            subtitle: 'Managed relationships',
            trend: '+0%',
            trendPositive: true,
            icon: Users,
          },
          {
            label: 'Hearings Today',
            value: String(hearingsToday.length),
            subtitle: 'Court events',
            trend: '+0%',
            trendPositive: true,
            icon: CalendarDays,
          },
          {
            label: 'Tasks Due Today',
            value: String(tasksToday.length),
            subtitle: 'Due by end of day',
            trend: '+0%',
            trendPositive: false,
            icon: ClipboardList,
          },
          {
            label: 'Outstanding Payments',
            value: `AED ${Math.round(outstanding)}`,
            subtitle: 'Pending receivables',
            trend: '+0%',
            trendPositive: true,
            icon: CreditCard,
          },
          {
            label: 'Monthly Revenue',
            value: `AED ${Math.round(revenue)}`,
            subtitle: 'This month',
            trend: '+0%',
            trendPositive: true,
            icon: ShieldCheck,
          },
          {
            label: 'Documents Uploaded',
            value: String(docsCount),
            subtitle: 'Case materials',
            trend: '+0%',
            trendPositive: true,
            icon: FileText,
          },
          {
            label: 'Staff Online',
            value: String(staffCount),
            subtitle: 'Available team',
            trend: '+0%',
            trendPositive: true,
            icon: FolderOpen,
          },
        ]);
      } catch (err) {
        // ignore errors for now
        // console.error(err);
      }
    }

    load();
  }, []);

  return (
    <div className="dashboard-page">
      <section className="dashboard-header">
        <div>
          <p className="page-eyebrow">Executive overview</p>
          <h2>SHAB Legal Consultancy</h2>
          <p className="page-intro">
            A premium overview of cases, clients, hearings, and revenue with a centralized command center for your legal practice.
          </p>
        </div>
      </section>

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
          />
        ))}
      </section>

      <QuickActions />

      <section className="dashboard-layout">
        <div className="dashboard-col-left">
          <RecentCases />
          <UpcomingHearings />
          <ActivityFeed />
        </div>

        <div className="dashboard-col-right">
          <TaskWidget />
          <RevenueChart />
          <CaseDistribution />
          <CalendarWidget />
          <Notifications />
        </div>
      </section>
    </div>
  );
}
