import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, FileText, CreditCard, AlertCircle } from 'lucide-react';
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { formatDateTime } from '@/utils/format';
import type { Notification } from '@/api/notification.api';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const handleClick = (n: Notification) => {
    if (!n.is_read) markAsRead.mutate(n.id);
    if (n.entity_type === 'invoice' && n.entity_id) navigate(`/invoices/${n.entity_id}`);
    else if (n.entity_type === 'payment' && n.entity_id) navigate(`/payments/${n.entity_id}`);
  };

  if (isLoading) return <LoadingSpinner />;

  const notifications = (data?.data ?? []) as Notification[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Мэдэгдэл</h1>
        {notifications.length > 0 && (
          <button onClick={() => markAllAsRead.mutate()} disabled={markAllAsRead.isPending} className="btn-secondary text-sm">
            <CheckCheck className="h-4 w-4" /> Бүгдийг уншсан болгох
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card py-12 text-center">
          <Bell className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm text-gray-500">Мэдэгдэл байхгүй байна</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = n.type.includes('INVOICE') ? FileText : n.type.includes('PAYMENT') ? CreditCard : n.type.includes('ALERT') ? AlertCircle : Bell;
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-colors ${
                  n.is_read ? 'border-gray-200 bg-white hover:bg-gray-50' : 'border-primary-200 bg-primary-50 hover:bg-primary-100'
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${n.is_read ? 'bg-gray-100' : 'bg-primary-100'}`}>
                  <Icon className={`h-5 w-5 ${n.is_read ? 'text-gray-500' : 'text-primary-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm ${n.is_read ? 'font-medium text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</p>
                    <span className="shrink-0 text-xs text-gray-400">{formatDateTime(n.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500 truncate">{n.message}</p>
                </div>
                {!n.is_read && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
