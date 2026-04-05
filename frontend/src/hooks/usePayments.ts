import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { paymentApi, type PaymentListParams } from '@/api/payment.api';

export function usePayments(params: PaymentListParams) {
  return useQuery({
    queryKey: ['payments', params],
    queryFn: () => paymentApi.getPayments(params),
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: ['payment', id],
    queryFn: () => paymentApi.getPaymentById(id),
    enabled: !!id,
  });
}

export function usePaymentsByInvoice(invoiceId: string) {
  return useQuery({
    queryKey: ['payments-by-invoice', invoiceId],
    queryFn: () => paymentApi.getPaymentsByInvoice(invoiceId),
    enabled: !!invoiceId,
  });
}

export function useApprovePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => paymentApi.approvePayment(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      toast.success('Төлбөр амжилттай батлагдлаа');
    },
    onError: () => toast.error('Төлбөр батлахад алдаа гарлаа'),
  });
}

export function useRejectPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      paymentApi.rejectPayment(id, reason),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment', id] });
      toast.success('Төлбөр татгалзагдлаа');
    },
    onError: () => toast.error('Төлбөр татгалзахад алдаа гарлаа'),
  });
}
