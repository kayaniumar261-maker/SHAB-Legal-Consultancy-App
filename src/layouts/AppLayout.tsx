import {
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  CreditCard,
  FileText,
  FolderOpen,
  Gavel,
  LayoutDashboard,
  Menu,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import {
  NavLink,
  Outlet,
  useNavigate,
} from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

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
    label: 'Payments',
    path: '/payments',
    icon: CreditCard,
  },
  {
    label: 'Staff',
    path: '/staff',
    icon: Users,
  },
  {
    label: 'Settings',
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
  const { signOut } = useAuth();

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <SidebarContent />
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
              SHAB Legal Consultancy
            </p>

            <h1 className="header-title">
              Practice Management
            </h1>
          </div>

          <div className="header-profile">
            <div className="profile-avatar">
              UK
            </div>

            <div className="profile-details">
              <strong>Umar Kayani</strong>
              <span>Administrator</span>
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
};

function SidebarContent({
  onNavigate,
}: SidebarContentProps) {
  return (
    <div className="sidebar-content">
      <div className="brand-block">
        <div className="brand-icon">
          <FileText size={28} />
        </div>

        <div>
          <div className="brand-name">
            SHAB
          </div>

          <div className="brand-subtitle">
            Legal Consultancy
          </div>
        </div>
      </div>

      <nav className="sidebar-navigation">
        {navigationItems.map(
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
          SHAB Legal Consultancy App
        </p>

        <span>Version 1.0.0</span>
      </div>
    </div>
  );
}
