import {
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  CreditCard,
  FileUp,
  FolderOpen,
  Gavel,
  LayoutDashboard,
  Menu,
  ReceiptText,
  Settings,
  Store,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import {
  NavLink,
  Outlet,
  useNavigate,
} from 'react-router-dom';

import { useAccessProfile } from '../hooks/useAccessProfile';
import { useAuth } from '../hooks/useAuth';
import { shabLogoUrl } from '../constants/branding';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { GlobalSearch } from '../components/search/GlobalSearch';
import { NotificationCenter } from '../components/notifications/NotificationCenter';

const navigationItems = [
  {
    label: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
  },
  {
    label: 'Clients',
    path: '/clients',
    icon: Users,
  },
  {
    label: 'Cases',
    path: '/cases',
    icon: BriefcaseBusiness,
  },
  {
    label: 'Tasks',
    path: '/tasks',
    icon: CheckSquare,
  },
  {
    label: 'Hearings',
    path: '/hearings',
    icon: Gavel,
  },
  {
    label: 'Calendar',
    path: '/calendar',
    icon: CalendarDays,
  },
  {
    label: 'Documents',
    path: '/documents',
    icon: FolderOpen,
  },
  {
    label: 'Import Centre',
    adminOnly: true,
    path: '/imports',
    icon: FileUp,
  },
  {
    label: 'Payments',
    adminOnly: true,
    path: '/payments',
    icon: CreditCard,
  },
  {
    label: 'Expenses',
    adminOnly: true,
    path: '/expenses',
    icon: ReceiptText,
  },
  {
    label: 'Vendors',
    adminOnly: true,
    path: '/vendors',
    icon: Store,
  },
  {
    label: 'Accounting',
    adminOnly: true,
    path: '/accounting',
    icon: BookOpenCheck,
  },
  {
    label: 'Staff',
    adminOnly: true,
    path: '/staff',
    icon: Users,
  },
  {
    label: 'Settings',
    adminOnly: true,
    path: '/settings',
    icon: Settings,
  },
];

export function AppLayout() {
  const [
    isMobileMenuOpen,
    setIsMobileMenuOpen,
  ] = useState(false);
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { profile } = useAccessProfile();
  const administrator = profile?.access_role === 'administrator' && profile.is_active;
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'SHAB User';

  const isOnline = useOnlineStatus();

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <SidebarContent isAdministrator={administrator} />
      </aside>

      {isMobileMenuOpen && (
        <div className="mobile-menu-layer">
          <button
            type="button"
            className="mobile-menu-backdrop"
            aria-label="Close navigation"
            onClick={closeMobileMenu}
          />

          <aside className="mobile-sidebar">
            <button
              type="button"
              className="mobile-menu-close"
              onClick={closeMobileMenu}
              aria-label="Close navigation"
            >
              <X size={22} />
            </button>

            <SidebarContent
              onNavigate={closeMobileMenu}
              isAdministrator={administrator}
            />
          </aside>
        </div>
      )}

      <div className="app-content">
        <header className="top-header">
          <button
            type="button"
            className="mobile-menu-button"
            onClick={() =>
              setIsMobileMenuOpen(true)
            }
            aria-label="Open navigation"
          >
            <Menu size={22} />
          </button>

          <div>
            <p className="header-eyebrow">
              SHAB Legal Consultants FZC
            </p>

            <h1 className="header-title">
              Practice Management
            </h1>
          </div>

          <GlobalSearch />

          <NotificationCenter />

          <div
            className={
              isOnline
                ? 'connection-status online'
                : 'connection-status offline'
            }
            title={
              isOnline
                ? 'Connected to live SHAB services'
                : 'Offline: live Supabase data may not load or save'
            }
          >
            <span />
            {isOnline ? 'Online' : 'Offline'}
          </div>

          <div className="header-profile">
            <div className="profile-avatar">
              {getInitials(displayName)}
            </div>

            <div className="profile-details">
              <strong>{displayName}</strong>
              <span>{administrator ? 'Administrator' : 'Operations Staff'}</span>
            </div>

            <button
              type="button"
              className="signout-button"
              onClick={async () => {
                await signOut();
                navigate('/login', { replace: true });
              }}
            >
              Sign Out
            </button>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

type SidebarContentProps = {
  onNavigate?: () => void;
  isAdministrator: boolean;
};

function SidebarContent({
  onNavigate,
  isAdministrator,
}: SidebarContentProps) {
  return (
    <div className="sidebar-content">
      <div className="brand-block">
        <img
          className="sidebar-brand-logo"
          src={shabLogoUrl}
          alt="SHAB Legal Consultants FZC"
        />
      </div>

      <nav className="sidebar-navigation">
        {navigationItems.filter((item) => !item.adminOnly || isAdministrator).map(
          ({
            label,
            path,
            icon: Icon,
          }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              onClick={onNavigate}
              className={({
                isActive,
              }) =>
                [
                  'sidebar-link',
                  isActive
                    ? 'sidebar-link-active'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')
              }
            >
              <Icon size={20} />

              <span>{label}</span>
            </NavLink>
          ),
        )}
      </nav>

      <div className="sidebar-footer">
        <p>
          SHAB Legal Consultants FZC
        </p>

        <span>Version 2.0.0</span>
      </div>
    </div>
  );
}

function getInitials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'SH';
}
