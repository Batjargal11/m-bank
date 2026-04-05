import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, XCircle, CreditCard, Trash2, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useInvoice, useInvoiceHistory, useSendInvoice, useCancelInvoice } from '@/hooks/useInvoices';
import { useAuthStore } from '@/store/auth.store';
import { hasPermission } from '@/utils/rbac';
import StatusBadge from '@/components/common/StatusBadge';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: invoice, isLoading } = useInvoice(id!);
  const { data: history } = useInvoiceHistory(id!);
  const sendInvoice = useSendInvoice();
  const cancelInvoice = useCancelInvoice();

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  if (isLoading) return <LoadingSpinner />;
  if (!invoice) return <div className="py-12 text-center text-gray-500">Нэхэмжлэх олдсонгүй</div>;

  const isSender = user?.orgId === invoice.sender_org_id;
  const isReceiver = user?.orgId === invoice.receiver_org_id;

  const handleSend = () => sendInvoice.mutate(invoice.invoice_id);
  const handleCancel = () => {
    if (!cancelReason.trim()) return;
    cancelInvoice.mutate(
      { id: invoice.invoice_id, reason: cancelReason },
      { onSuccess: () => { setShowCancelDialog(false); setCancelReason(''); } },
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Нэхэмжлэх #{invoice.invoice_no}</h1>
          <div className="mt-1 flex items-center gap-3">
            <StatusBadge status={invoice.status} />
            <span className="text-sm text-gray-500">Үүсгэсэн: {formatDate(invoice.created_at)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {isSender && invoice.status === 'DRAFT' && (
            <>
              <button onClick={handleSend} disabled={sendInvoice.isPending} className="btn-primary">
                <Send className="h-4 w-4" /> Илгээх
              </button>
              <button onClick={() => invoiceApi_delete(invoice.invoice_id)} className="btn-danger">
                <Trash2 className="h-4 w-4" /> Устгах
              </button>
            </>
          )}
          {isSender && ['SENT', 'RECEIVED', 'VIEWED'].includes(invoice.status) && (
            <button onClick={() => setShowCancelDialog(true)} className="btn-danger">
              <XCircle className="h-4 w-4" /> Цуцлах
            </button>
          )}
          {isReceiver && ['RECEIVED', 'VIEWED', 'SENT'].includes(invoice.status) && user && hasPermission(user.role, 'invoice:pay') && (
            <button onClick={() => navigate(`/payments/new?invoiceId=${invoice.invoice_id}&amount=${invoice.outstanding_amount}`)} className="btn-primary">
              <CreditCard className="h-4 w-4" /> Төлбөр хийх
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Дэлгэрэнгүй</h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Илгээгч" value={invoice.sender_org_name} />
            <InfoRow label="Хүлээн авагч" value={invoice.receiver_org_name} />
            <InfoRow label="Огноо" value={formatDate(invoice.issue_date)} />
            <InfoRow label="Дуусах огноо" value={formatDate(invoice.due_date)} />
            <InfoRow label="Валют" value={invoice.currency} />
            <InfoRow label="НӨАТ" value={formatCurrency(Number(invoice.vat_amount), invoice.currency)} />
            <InfoRow label="Нийт дүн" value={formatCurrency(Number(invoice.total_amount), invoice.currency)} highlight />
            <InfoRow label="Төлөгдсөн" value={formatCurrency(Number(invoice.paid_amount), invoice.currency)} />
            <InfoRow label="Үлдэгдэл" value={formatCurrency(Number(invoice.outstanding_amount), invoice.currency)} highlight />
          </div>
          {invoice.notes && (
            <div>
              <p className="text-sm font-medium text-gray-500">Тайлбар</p>
              <p className="mt-1 text-sm text-gray-700">{invoice.notes}</p>
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Статусын түүх</h2>
          <div className="space-y-3">
            {(history ?? []).map((entry: any, idx: number) => (
              <div key={idx} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100">
                    {getHistoryIcon(entry.to_status || '')}
                  </div>
                  {idx < (history?.length ?? 0) - 1 && <div className="w-px flex-1 bg-gray-200" />}
                </div>
                <div className="pb-4">
                  <p className="text-sm font-medium text-gray-900">
                    {entry.from_status ? `${entry.from_status} → ${entry.to_status}` : entry.to_status}
                  </p>
                  <p className="text-xs text-gray-500">{entry.reason || ''}</p>
                  <p className="text-xs text-gray-400">{formatDateTime(entry.created_at)}</p>
                </div>
              </div>
            ))}
            {(!history || history.length === 0) && <p className="text-sm text-gray-500">Түүх олдсонгүй</p>}
          </div>
        </div>
      </div>

      {invoice.items && invoice.items.length > 0 && (
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Бараа / Үйлчилгээ</h2>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Тайлбар</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Тоо</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Нэгж үнэ</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Татвар</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Нийт</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                  <td className="px-4 py-3 text-right text-sm">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-sm">{formatCurrency(Number(item.unit_price), invoice.currency)}</td>
                  <td className="px-4 py-3 text-right text-sm">{formatCurrency(Number(item.tax_amount), invoice.currency)}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(Number(item.total_price), invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={showCancelDialog}
        title="Нэхэмжлэх цуцлах"
        message="Та энэ нэхэмжлэхийг цуцлахдаа итгэлтэй байна уу?"
        confirmLabel="Цуцлах"
        onConfirm={handleCancel}
        onCancel={() => { setShowCancelDialog(false); setCancelReason(''); }}
      >
        <textarea
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          className="input-field mt-3"
          rows={3}
          placeholder="Цуцлах шалтгаан..."
        />
      </ConfirmDialog>
    </div>
  );
}

function invoiceApi_delete(_id: string) {
  // TODO: implement delete
}

function InfoRow({ label, value, highlight = false }: { readonly label: string; readonly value: string; readonly highlight?: boolean }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-0.5 text-sm ${highlight ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{value}</p>
    </div>
  );
}

function getHistoryIcon(status: string) {
  if (status.includes('SENT')) return <Send className="h-3.5 w-3.5 text-primary-600" />;
  if (status.includes('CANCEL')) return <XCircle className="h-3.5 w-3.5 text-red-600" />;
  if (status.includes('PAID')) return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
  if (status.includes('FAIL')) return <AlertCircle className="h-3.5 w-3.5 text-red-600" />;
  return <Clock className="h-3.5 w-3.5 text-gray-500" />;
}
