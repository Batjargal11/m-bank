import { Link } from 'react-router-dom';
import { Bell, LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useNotificationStore } from '@/store/notification.store';

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: 'Админ',
  BANK_OPERATOR: 'Оператор',
  MAKER: 'Үүсгэгч',
  CHECKER: 'Шалгагч',
  VIEWER: 'Үзэгч',
};

const ROLE_COLORS: Record<string, string> = {
  SYSTEM_ADMIN: 'bg-red-100 text-red-700',
  BANK_OPERATOR: 'bg-purple-100 text-purple-700',
  MAKER: 'bg-blue-100 text-blue-700',
  CHECKER: 'bg-amber-100 text-amber-700',
  VIEWER: 'bg-gray-100 text-gray-700',
};

export default function Header() {
  const { user, logout } = useAuth();
  useUnreadCount();
  const { unreadCount } = useNotificationStore();

  if (!user) return null;

  const roleLabel = ROLE_LABELS[user.role] || user.role;
  const roleColor = ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-700';

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">{user.orgName}</span>
      </div>

      <div className="flex items-center gap-4">
        <Link
          to="/notifications"
          className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
            <User className="h-4 w-4 text-primary-600" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-700">{user.username}</p>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${roleColor}`}>
              {roleLabel}
            </span>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
          title="Гарах"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
