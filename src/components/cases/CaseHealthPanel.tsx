import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  HeartPulse,
  ListTodo,
  Scale,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';

import {
  useMemo,
  type ReactNode,
} from 'react';

import './CaseHealthPanel.css';

type CaseHealthPanelProps = {
  progress: number;
  recoveryRate: number;
  openTasks: number;
  overdueTasks: number;
  hasUpcomingHearing: boolean;
  nextHearingAt?: string | null;
  timelineCount: number;
  urgent: boolean;
  highRisk: boolean;
  outstandingBalance: number | null;
  nextActionOverdue: boolean;
};

type HealthTone =
  | 'excellent'
  | 'healthy'
  | 'attention'
  | 'critical';

type HealthFactor = {
  id: string;
  label: string;
  detail: string;
  positive: boolean;
  icon: ReactNode;
};

export function CaseHealthPanel({
  progress,
  recoveryRate,
  openTasks,
  overdueTasks,
  hasUpcomingHearing,
  nextHearingAt,
  timelineCount,
  urgent,
  highRisk,
  outstandingBalance,
  nextActionOverdue,
}: CaseHealthPanelProps) {
  const health = useMemo(() => {
    let score = 100;

    const deductions: string[] = [];
    const positives: string[] = [];
    const actions: string[] = [];

    if (overdueTasks > 0) {
      const deduction = Math.min(
        30,
        overdueTasks * 10,
      );

      score -= deduction;

      deductions.push(
        `${overdueTasks} overdue task${
          overdueTasks === 1 ? '' : 's'
        }`,
      );

      actions.push(
        'Resolve overdue tasks',
      );
    }

    const nonOverdueOpenTasks =
      Math.max(
        0,
        openTasks - overdueTasks,
      );

    if (nonOverdueOpenTasks > 0) {
      score -= Math.min(
        10,
        nonOverdueOpenTasks * 2,
      );

      deductions.push(
        `${openTasks} open task${
          openTasks === 1 ? '' : 's'
        }`,
      );
    } else if (openTasks === 0) {
      positives.push(
        'No outstanding tasks',
      );
    }

    if (!hasUpcomingHearing) {
      score -= 15;

      deductions.push(
        'No upcoming hearing',
      );

      actions.push(
        'Review whether a hearing must be scheduled',
      );
    } else {
      positives.push(
        'Upcoming hearing scheduled',
      );
    }

    if (urgent) {
      score -= 20;

      deductions.push(
        'Matter marked urgent',
      );

      actions.push(
        'Immediate lawyer review required',
      );
    }

    if (highRisk) {
      score -= 15;

      deductions.push(
        'High-risk matter',
      );

      actions.push(
        'Review risk controls and legal strategy',
      );
    }

    if (nextActionOverdue) {
      score -= 15;

      deductions.push(
        'Next action is overdue',
      );

      actions.push(
        'Complete or reschedule the overdue next action',
      );
    }

    if (outstandingBalance === null) {
      actions.push(
        'Review finance data availability',
      );
    } else if (
      outstandingBalance >= 100_000
    ) {
      score -= 15;

      deductions.push(
        'Substantial outstanding balance',
      );

      actions.push(
        'Escalate collection follow-up',
      );
    } else if (
      outstandingBalance >= 50_000
    ) {
      score -= 10;

      deductions.push(
        'Outstanding fees require follow-up',
      );

      actions.push(
        'Follow up outstanding payments',
      );
    } else if (
      outstandingBalance > 0
    ) {
      score -= 5;

      deductions.push(
        'Unpaid case balance',
      );

      actions.push(
        'Review outstanding fees',
      );
    } else {
      positives.push(
        'No outstanding case balance',
      );
    }

    if (timelineCount === 0) {
      score -= 10;

      deductions.push(
        'No recent matter activity',
      );

      actions.push(
        'Record the latest matter update',
      );
    } else {
      positives.push(
        'Matter activity recorded',
      );
    }

    if (progress < 25) {
      score -= 15;

      deductions.push(
        'Matter progress remains low',
      );

      actions.push(
        'Advance the matter to its next stage',
      );
    } else if (progress < 40) {
      score -= 8;

      deductions.push(
        'Matter progress requires attention',
      );
    } else {
      positives.push(
        'Matter is progressing',
      );
    }

    if (recoveryRate >= 95) {
      score += 10;

      positives.push(
        'Excellent recovery position',
      );
    } else if (recoveryRate >= 80) {
      score += 5;

      positives.push(
        'Healthy recovery rate',
      );
    } else if (
      recoveryRate > 0 &&
      recoveryRate < 50
    ) {
      score -= 5;

      deductions.push(
        'Recovery rate is below 50%',
      );

      actions.push(
        'Review recovery and enforcement strategy',
      );
    }

    score = Math.round(
      Math.max(
        0,
        Math.min(100, score),
      ),
    );

    let tone: HealthTone;
    let label: string;
    let summary: string;

    if (score >= 90) {
      tone = 'excellent';
      label = 'Excellent';
      summary =
        'This matter is well controlled and progressing without major concerns.';
    } else if (score >= 75) {
      tone = 'healthy';
      label = 'Healthy';
      summary =
        'The matter is generally progressing well, with limited items requiring review.';
    } else if (score >= 50) {
      tone = 'attention';
      label = 'Needs Attention';
      summary =
        'Several operational or financial issues should be addressed to protect progress.';
    } else {
      tone = 'critical';
      label = 'Critical';
      summary =
        'Immediate management attention is required to reduce matter risk and delay.';
    }

    return {
      score,
      tone,
      label,
      summary,
      deductions,
      positives,
      actions: Array.from(
        new Set(actions),
      ).slice(0, 4),
    };
  }, [
    hasUpcomingHearing,
    highRisk,
    nextActionOverdue,
    openTasks,
    outstandingBalance,
    overdueTasks,
    progress,
    recoveryRate,
    timelineCount,
    urgent,
  ]);

  const factors =
    useMemo<HealthFactor[]>(() => [
      {
        id: 'tasks',
        label: 'Task Control',
        detail:
          overdueTasks > 0
            ? `${overdueTasks} overdue`
            : openTasks > 0
              ? `${openTasks} open`
              : 'Clear',
        positive:
          overdueTasks === 0,
        icon:
          <ListTodo size={15} />,
      },
      {
        id: 'hearing',
        label: 'Court Schedule',
        detail:
          hasUpcomingHearing
            ? formatOptionalDate(
                nextHearingAt,
              )
            : 'Not scheduled',
        positive:
          hasUpcomingHearing,
        icon:
          <CalendarCheck
            size={15}
          />,
      },
      {
        id: 'finance',
        label: 'Case Balance',
        detail:
          outstandingBalance === null
            ? 'Unavailable'
            : outstandingBalance > 0
            ? formatCurrency(
                outstandingBalance,
              )
            : 'Clear',
        positive:
          outstandingBalance === 0,
        icon:
          <CircleDollarSign
            size={15}
          />,
      },
      {
        id: 'recovery',
        label: 'Recovery',
        detail:
          `${recoveryRate.toFixed(0)}%`,
        positive:
          recoveryRate >= 80,
        icon:
          <TrendingUp size={15} />,
      },
    ], [
      hasUpcomingHearing,
      nextHearingAt,
      openTasks,
      outstandingBalance,
      overdueTasks,
      recoveryRate,
    ]);

  return (
    <article
      className={`case-health-panel ${health.tone}`}
    >
      <header className="case-health-header">
        <div className="case-health-heading">
          <span className="case-health-icon">
            <HeartPulse size={19} />
          </span>

          <div>
            <span>
              Matter intelligence
            </span>

            <h3>Case Health</h3>
          </div>
        </div>

        <span
          className={`case-health-status ${health.tone}`}
        >
          {health.label}
        </span>
      </header>

      <div className="case-health-overview">
        <div
          className={`case-health-score ${health.tone}`}
          style={{
            '--health-score':
              `${health.score * 3.6}deg`,
          } as React.CSSProperties}
        >
          <div>
            <strong>
              {health.score}
            </strong>

            <span>/100</span>
          </div>
        </div>

        <div className="case-health-summary">
          <strong>
            {health.label}
          </strong>

          <p>
            {health.summary}
          </p>

          <div className="case-health-progress-track">
            <div
              className="case-health-progress-value"
              style={{
                width:
                  `${health.score}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="case-health-factors">
        {factors.map((factor) => (
          <div
            key={factor.id}
            className={
              factor.positive
                ? 'case-health-factor positive'
                : 'case-health-factor warning'
            }
          >
            <span>
              {factor.icon}
            </span>

            <div>
              <small>
                {factor.label}
              </small>

              <strong>
                {factor.detail}
              </strong>
            </div>
          </div>
        ))}
      </div>

      {health.actions.length > 0 ? (
        <div className="case-health-actions">
          <div className="case-health-actions-heading">
            <ShieldAlert size={16} />

            <strong>
              Recommended Actions
            </strong>
          </div>

          <div>
            {health.actions.map(
              (action) => (
                <span key={action}>
                  <AlertTriangle
                    size={13}
                  />

                  {action}
                </span>
              ),
            )}
          </div>
        </div>
      ) : (
        <div className="case-health-clear">
          <CheckCircle2 size={17} />

          <div>
            <strong>
              No immediate action required
            </strong>

            <span>
              Continue monitoring this matter through normal workflow.
            </span>
          </div>
        </div>
      )}

      <footer className="case-health-footer">
        <div>
          <Scale size={14} />

          <span>
            Progress {progress.toFixed(0)}%
          </span>
        </div>

        <div>
          {urgent || highRisk ? (
            <ShieldAlert size={14} />
          ) : (
            <CheckCircle2 size={14} />
          )}

          <span>
            {urgent
              ? 'Urgent matter'
              : highRisk
                ? 'High risk'
                : 'Risk controlled'}
          </span>
        </div>
      </footer>
    </article>
  );
}

function formatCurrency(
  value: number,
): string {
  return new Intl.NumberFormat(
    'en-AE',
    {
      style: 'currency',
      currency: 'AED',
      maximumFractionDigits: 0,
    },
  ).format(value);
}

function formatOptionalDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'Scheduled';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Scheduled';
  }

  return new Intl.DateTimeFormat(
    'en-AE',
    {
      day: '2-digit',
      month: 'short',
    },
  ).format(date);
}
