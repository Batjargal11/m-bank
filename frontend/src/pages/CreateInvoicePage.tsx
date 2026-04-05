import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Send } from 'lucide-react';
import { useCreateInvoice, useSendInvoice } from '@/hooks/useInvoices';
import { orgApi, type Organization } from '@/api/org.api';
import { useAuthStore } from '@/store/auth.store';

interface LineItem {
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: number;
}

export default function CreateInvoicePage() {
  const navigate = useNavigate();
  const createInvoice = useCreateInvoice();
  const sendInvoice = useSendInvoice();
  const { user } = useAuthStore();
  const [organizations, setOrganizations] = useState<readonly Organization[]>([]);

  useEffect(() => {
    orgApi.getOrganizations().then((orgs) => {
      const filtered = orgs.filter((o) => o.org_id !== user?.orgId);
      setOrganizations(filtered);
    }).catch(() => {});
  }, [user?.orgId]);

  const [receiverOrgId, setReceiverOrgId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('MNT');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<readonly LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [sendAfterCreate, setSendAfterCreate] = useState(false);

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const getLineTotal = (item: LineItem) => item.quantity * item.unitPrice;
  const grandTotal = items.reduce((sum, item) => sum + getLineTotal(item), 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const invoiceItems = items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      tax_amount: 0,
    }));

    try {
      const created = await createInvoice.mutateAsync({
        invoice_no: invoiceNumber,
        receiver_org_id: receiverOrgId,
        issue_date: issueDate,
        due_date: dueDate,
        currency,
        vat_amount: 0,
        notes: notes || undefined,
        items: invoiceItems,
      } as any);

      const invoiceId = created?.invoice_id;
      if (sendAfterCreate && invoiceId) {
        await sendInvoice.mutateAsync(invoiceId);
      }
      navigate(`/invoices/${invoiceId}`);
    } catch {
      // handled by mutation
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Нэхэмжлэх үүсгэх</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Үндсэн мэдээлэл</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Хүлээн авагч байгууллага</label>
              <select value={receiverOrgId} onChange={(e) => setReceiverOrgId(e.target.value)} className="input-field" required>
                <option value="">-- Байгууллага сонгох --</option>
                {organizations.map((org) => (
                  <option key={org.org_id} value={org.org_id}>{org.name} ({org.registration_no})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Нэхэмжлэхийн дугаар</label>
              <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="input-field" placeholder="INV-001" required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Үүсгэсэн огноо</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="input-field" required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Дуусах огноо</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-field" required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Валют</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input-field">
                <option value="MNT">MNT - Монгол төгрөг</option>
                <option value="USD">USD - Ам.доллар</option>
                <option value="EUR">EUR - Евро</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Тайлбар</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field" rows={2} placeholder="Нэмэлт тайлбар..." />
          </div>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Бүтээгдэхүүн / Үйлчилгээ</h2>
            <button type="button" onClick={addItem} className="btn-secondary text-sm">
              <Plus className="h-4 w-4" /> Мөр нэмэх
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 text-left text-xs font-semibold uppercase text-gray-500">Тайлбар</th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase text-gray-500 w-24">Тоо</th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase text-gray-500 w-36">Нэгж үнэ</th>
                  <th className="pb-2 text-right text-xs font-semibold uppercase text-gray-500 w-36">Нийт</th>
                  <th className="pb-2 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 pr-2">
                      <input type="text" value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} className="input-field" placeholder="Бүтээгдэхүүн / Үйлчилгээ" required />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} className="input-field" min={1} required />
                    </td>
                    <td className="py-2 pr-2">
                      <input type="number" value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', Number(e.target.value))} className="input-field" min={0} required />
                    </td>
                    <td className="py-2 pr-2 text-right text-sm font-medium text-gray-900">
                      {formatAmount(getLineTotal(item), currency)}
                    </td>
                    <td className="py-2">
                      <button type="button" onClick={() => removeItem(idx)} disabled={items.length <= 1} className="rounded p-1 text-gray-400 hover:text-red-500 disabled:opacity-30">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end border-t border-gray-200 pt-4">
            <div className="flex justify-between w-64 text-base">
              <span className="font-semibold text-gray-900">Нийт дүн:</span>
              <span className="font-bold text-gray-900">{formatAmount(grandTotal, currency)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={sendAfterCreate} onChange={(e) => setSendAfterCreate(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span className="text-sm text-gray-700">Үүсгэсний дараа шууд илгээх</span>
          </label>
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Цуцлах</button>
            <button type="submit" disabled={createInvoice.isPending || sendInvoice.isPending} className="btn-primary">
              {sendAfterCreate ? (<><Send className="h-4 w-4" /> Үүсгэж илгээх</>) : 'Ноорог хадгалах'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('mn-MN', {
    style: 'currency', currency,
    minimumFractionDigits: currency === 'MNT' ? 0 : 2,
    maximumFractionDigits: currency === 'MNT' ? 0 : 2,
  }).format(amount);
}
