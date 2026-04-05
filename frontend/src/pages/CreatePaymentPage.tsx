import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '@/api/client';
import { useAuthStore } from '@/store/auth.store';
import { orgApi, type Organization } from '@/api/org.api';
import type { Invoice } from '@/api/invoice.api';
import { formatCurrency } from '@/utils/format';
const uuidv4 = () => crypto.randomUUID();

interface Account {
  readonly account_id: string;
  readonly account_no: string;
  readonly currency: string;
  readonly is_active: boolean;
}

export default function CreatePaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();

  const invoiceId = searchParams.get('invoiceId') || '';
  const defaultAmount = searchParams.get('amount') || '';

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [payerAccount, setPayerAccount] = useState('');
  const [amount, setAmount] = useState(defaultAmount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (invoiceId) {
      apiClient.get(`/invoices/${invoiceId}`).then(({ data }) => {
        setInvoice(data.data);
        if (!amount) setAmount(data.data.outstanding_amount);
      }).catch(() => {});
    }
  }, [invoiceId]);

  useEffect(() => {
    if (user?.orgId) {
      apiClient.get(`/organizations/${user.orgId}/accounts`).then(({ data }) => {
        setAccounts(data.data);
        if (data.data.length > 0) setPayerAccount(data.data[0].account_no);
      }).catch(() => {});
    }
  }, [user?.orgId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!invoiceId || !payerAccount || !amount) return;

    setLoading(true);
    try {
      const idempotencyKey = uuidv4();
      const { data } = await apiClient.post('/payments', {
        invoice_id: invoiceId,
        payer_account: payerAccount,
        amount: Number(amount),
        currency: invoice?.currency || 'MNT',
      }, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });

      toast.success('Төлбөр амжилттай үүсгэлээ');
      navigate(`/payments/${data.data.payment_id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Төлбөр хийхэд алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Төлбөр хийх</h1>
      </div>

      {invoice && (
        <div className="card bg-blue-50 border border-blue-200">
          <h3 className="font-semibold text-blue-900">Нэхэмжлэхийн мэдээлэл</h3>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-blue-600">Дугаар:</span>{' '}
              <span className="font-medium text-blue-900">{invoice.invoice_no}</span>
            </div>
            <div>
              <span className="text-blue-600">Илгээгч:</span>{' '}
              <span className="font-medium text-blue-900">{invoice.sender_org_name}</span>
            </div>
            <div>
              <span className="text-blue-600">Нийт дүн:</span>{' '}
              <span className="font-bold text-blue-900">{formatCurrency(Number(invoice.total_amount), invoice.currency)}</span>
            </div>
            <div>
              <span className="text-blue-600">Үлдэгдэл:</span>{' '}
              <span className="font-bold text-blue-900">{formatCurrency(Number(invoice.outstanding_amount), invoice.currency)}</span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-5">
        <h2 className="text-lg font-semibold text-gray-900">Төлбөрийн мэдээлэл</h2>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Төлөх данс</label>
          <select
            value={payerAccount}
            onChange={(e) => setPayerAccount(e.target.value)}
            className="input-field"
            required
          >
            <option value="">-- Данс сонгох --</option>
            {accounts.map((acc) => (
              <option key={acc.account_id} value={acc.account_no}>
                {acc.account_no} ({acc.currency}) {!acc.is_active ? '(Идэвхгүй)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Төлөх дүн</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-field"
            min={1}
            step="0.01"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Үлдэгдэл: {invoice ? formatCurrency(Number(invoice.outstanding_amount), invoice.currency) : '—'}
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            Цуцлах
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              'Төлж байна...'
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Төлбөр хийх
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
