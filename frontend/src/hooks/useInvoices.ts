import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { invoiceApi, type InvoiceListParams } from '@/api/invoice.api';

export function useInvoices(params: InvoiceListParams) {
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: () => invoiceApi.getInvoices(params),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoiceApi.getInvoiceById(id),
    enabled: !!id,
  });
}

export function useInvoiceHistory(id: string) {
  return useQuery({
    queryKey: ['invoice-history', id],
    queryFn: () => invoiceApi.getInvoiceHistory(id),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => invoiceApi.createInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Нэхэмжлэх амжилттай үүсгэлээ');
    },
    onError: () => {
      toast.error('Нэхэмжлэх үүсгэхэд алдаа гарлаа');
    },
  });
}

export function useSendInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoiceApi.sendInvoice(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      toast.success('Нэхэмжлэх амжилттай илгээгдлээ');
    },
    onError: () => {
      toast.error('Нэхэмжлэх илгээхэд алдаа гарлаа');
    },
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      invoiceApi.cancelInvoice(id, reason),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.id] });
      toast.success('Нэхэмжлэх амжилттай цуцлагдлаа');
    },
    onError: () => {
      toast.error('Нэхэмжлэх цуцлахад алдаа гарлаа');
    },
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => invoiceApi.getDashboardStats(),
  });
}
