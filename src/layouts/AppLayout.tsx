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
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { useAccessProfile } from '../hooks/useAccessProfile';
import { useAuth } from '../hooks/useAuth';
import { shabLogoUrl } from '../constants/branding';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { GlobalSearch } from '../components/search/GlobalSearch';
import { NotificationCenter } from '../components/notifications/NotificationCenter';
import '../styles/MobileExperience.css';
import '../styles/MobileFormAccess.css';

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
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { profile } = useAccessProfile();
  const administrator = profile?.access_role === 'administrator' && profile.is_active;
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'SHAB User';
  const mobilePrimaryPaths = ['/', '/clients', '/cases', '/tasks'];
  const authorizedNavigationItems = navigationItems.filter(
    (item) => !item.adminOnly || administrator,
  );
  const mobileMoreItems = authorizedNavigationItems.filter(
    (item) => !mobilePrimaryPaths.includes(item.path),
  );

  const isOnline = useOnlineStatus();

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <SidebarContent
          isAdministrator={administrator}
          displayName={displayName}
          onSignOut={handleSignOut}
        />
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
              displayName={displayName}
              onSignOut={handleSignOut}
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
              {administrator ? 'Practice Management' : 'Operations Workspace'}
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
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>

        <nav className="operations-mobile-nav" aria-label="Application shortcuts">
          {authorizedNavigationItems
            .filter((item) => mobilePrimaryPaths.includes(item.path))
            .map(({ label, path, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                className={({ isActive }) =>
                  isActive ? 'operations-mobile-link active' : 'operations-mobile-link'
                }
              >
                <Icon size={20} />
                <span>{label}</span>
              </NavLink>
            ))}

          <button
            type="button"
            className={
              mobileMoreItems.some((item) =>
                location.pathname === item.path ||
                location.pathname.startsWith(`${item.path}/`),
              )
                ? 'operations-mobile-link active'
                : 'operations-mobile-link'
            }
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open all authorized modules"
          >
            <Menu size={20} />
            <span>More</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

type SidebarContentProps = {
  onNavigate?: () => void;
  isAdministrator: boolean;
  displayName: string;
  onSignOut: () => Promise<void>;
};

function SidebarContent({
  onNavigate,
  isAdministrator,
  displayName,
  onSignOut,
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

      <div className="sidebar-mobile-account">
        <div className="sidebar-mobile-avatar">{getInitials(displayName)}</div>
        <div>
          <strong>{displayName}</strong>
          <span>{isAdministrator ? 'Administrator' : 'Operations Staff'}</span>
        </div>
        <button type="button" onClick={() => void onSignOut()}>
          Sign Out
        </button>
      </div>

      <div className="sidebar-footer">
        <p>SHAB Legal Consultants FZC</p>
        <div className="sidebar-version-row">
          <span>v{__APP_VERSION__}</span>
          <span aria-hidden="true">&bull;</span>
          <span>{navigator.userAgent.includes('Electron') ? 'Updates enabled' : 'Browser deployment'}</span>
        </div>
      </div>
    </div>
  );
}

function getInitials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'SH';
}
