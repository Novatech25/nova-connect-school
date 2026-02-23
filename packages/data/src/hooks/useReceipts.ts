import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '../client';
import type { GenerateReceiptRequest } from '@novaconnect/core/schemas/receipts';

export function useGeneratePaymentReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: GenerateReceiptRequest) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('generate-payment-receipt', {
        body: request,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-receipts'] });
    },
  });
}

export function useGeneratePayrollSlip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: GenerateReceiptRequest) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('generate-payroll-slip', {
        body: request,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-slips'] });
    },
  });
}

export function useVerifyReceipt(token: string) {
  return useQuery({
    queryKey: ['verify-receipt', token],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('verify-receipt', {
        body: { token },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });
}

export function usePrinterProfiles(schoolId: string) {
  return useQuery({
    queryKey: ['printer-profiles', schoolId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('printer_profiles')
        .select('*')
        .eq('school_id', schoolId)
        .order('is_default', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}
