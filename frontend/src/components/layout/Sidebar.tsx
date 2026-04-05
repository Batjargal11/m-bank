import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Bell,
  ClipboardList,
  Building2,
  Settings,
  BookOpen,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { hasPermission } from '@/utils/rbac';

const navItems = [
  { to: '/', label: 'Хяналтын самбар', icon: LayoutDashboard, end: true },
  { to: '/invoices', label: 'Нэхэмжлэх', icon: FileText },
  { to: '/payments', label: 'Төлбөр', icon: CreditCard },
  { to: '/notifications', label: 'Мэдэгдэл', icon: Bell },
] as const;

export default function Sidebar() {
  const { user } = useAuthStore();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary-50 text-primary-700'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  return (
    <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">M-Bank</h1>
          <p className="text-xs text-gray-500">Нэхэмжлэх систем</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ to, label, icon: Icon, ...rest }) => (
          <NavLink key={to} to={to} className={linkClass} end={'end' in rest}>
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}

        {user && hasPermission(user.role, 'audit:read') && (
          <NavLink to="/audit" className={linkClass}>
            <ClipboardList className="h-5 w-5" />
            Аудит лог
          </NavLink>
        )}

        {user && user.role === 'SYSTEM_ADMIN' && (
          <NavLink to="/admin" className={linkClass}>
            <Settings className="h-5 w-5" />
            Админ
          </NavLink>
        )}
      </nav>

      <div className="border-t border-gray-200 px-3 py-3 space-y-1">
        <NavLink to="/docs" className={linkClass}>
          <BookOpen className="h-5 w-5" />
          Documentation
        </NavLink>
        <p className="text-xs text-gray-400 text-center pt-2">v1.0.0</p>
      </div>
    </aside>
  );
}
