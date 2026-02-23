import { getSupabaseClient } from '../client';
import { camelToSnakeKeys, snakeToCamelKeys } from '../helpers';
import { gatewayRequest, runWithStrategy } from '../helpers/hybrid-request';
import * as XLSX from 'xlsx';
import type {
  ReportCard,
  GenerateReportCardInput,
  GenerateBatchReportCardsInput,
  PublishReportCardInput,
  OverridePaymentBlockInput,
  ReportCardFilters,
  ExportReportCardsInput
} from '@novaconnect/core';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

export const reportCardQueries = {
  // Get all report cards with filters
  getAll: (schoolId: string, filters?: ReportCardFilters) => ({
    queryKey: ['report_cards', schoolId, filters],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      let query = supabase
        .from('report_cards')
        .select(`
          *,
          student:students(id, first_name, last_name, matricule),
          class:classes(id, name, code),
          period:periods(id, name, period_type),
          academic_year:academic_years(id, name)
        `)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (filters?.studentId) query = query.eq('student_id', filters.studentId);
      if (filters?.classId) query = query.eq('class_id', filters.classId);
      if (filters?.periodId) query = query.eq('period_id', filters.periodId);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.paymentStatus) query = query.eq('payment_status', filters.paymentStatus);
      if (filters?.academicYearId) query = query.eq('academic_year_id', filters.academicYearId);

      const { data, error } = await query;
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  // Get single report card by ID
  getById: (id: string) => ({
    queryKey: ['report_cards', id],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('report_cards')
        .select(`
          *,
          student:students(id, first_name, last_name, matricule, photo_url),
          class:classes(id, name, code),
          period:periods(id, name, period_type, start_date, end_date),
          academic_year:academic_years(id, name),
          grading_scale:grading_scales(id, name, scale_config)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  // Get report card versions
  getVersions: (reportCardId: string) => ({
    queryKey: ['report_card_versions', reportCardId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('report_card_versions')
        .select('*, changed_by_user:users!changed_by(first_name, last_name)')
        .eq('report_card_id', reportCardId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  // Generate single report card
  generate: () => ({
    mutationFn: async (input: GenerateReportCardInput) => {
      const supabase = getSupabaseClient();
      
      // FORCE SUPABASE: Ne pas utiliser le Gateway
      console.log('[DEBUG] Using Edge Function directly...');
      
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('Utilisateur non authentifié');
      }
      
      const { data, error } = await supabase.functions.invoke('generate-report-card-pdf', {
        body: input,
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
          'x-user-token': accessToken,
        },
      });

      if (error) {
        console.error('[DEBUG] Edge Function error:', error);
        throw error;
      }
      
      console.log('[DEBUG] Edge Function success:', data);
      return snakeToCamelKeys(data.reportCard);
    },
  }),

  // Generate batch report cards for a class
  generateBatch: () => ({
    mutationFn: async (input: GenerateBatchReportCardsInput) => {
      const supabase = getSupabaseClient();
      const strategy = 'gateway-first';

      const generateInGateway = async () => {
        const data = await gatewayRequest(
          '/report-cards/generate-batch',
          {
            method: 'POST',
            body: JSON.stringify(input),
          },
          supabase
        );
        return data as any;
      };

      const generateInSupabase = async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) {
          throw new Error('Utilisateur non authentifié');
        }

        const { data: enrollments, error: enrollError } = await supabase
          .from('enrollments')
          .select('student_id')
          .eq('class_id', input.classId);

        if (enrollError) throw enrollError;

        const results = await Promise.allSettled(
          enrollments.map(enrollment =>
            supabase.functions.invoke('generate-report-card-pdf', {
              body: {
                studentId: enrollment.student_id,
                periodId: input.periodId,
                regenerate: input.regenerate,
              },
              headers: {
                Authorization: `Bearer ${supabaseAnonKey}`,
                apikey: supabaseAnonKey,
                'x-user-token': accessToken,
              },
            })
          )
        );

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        return { successful, failed, total: enrollments.length };
      };

      return runWithStrategy({
        strategy,
        gateway: generateInGateway,
        supabase: generateInSupabase,
      });
    },
  }),

  // Publish report card
  publish: () => ({
    mutationFn: async (input: PublishReportCardInput) => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      // First, update the report card status
      const { data, error } = await supabase
        .from('report_cards')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          published_by: user?.id,
        })
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;

      // Send notifications to student and parents
      if (user?.id) {
        const { data: notificationResult, error: notificationError } = await supabase.rpc(
          'notify_report_card_published',
          {
            p_report_card_id: input.id,
            p_publisher_user_id: user.id
          }
        );

        if (notificationError) {
          console.error('[reportCards.publish] Error sending notifications:', notificationError);
          // Don't throw - the report card is already published, just log the error
        } else {
          console.log('[reportCards.publish] Notifications sent:', notificationResult);
        }
      }

      return snakeToCamelKeys(data);
    },
  }),

  // Override payment block
  overridePaymentBlock: () => ({
    mutationFn: async (input: OverridePaymentBlockInput) => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('report_cards')
        .update({
          payment_status_override: true,
          override_reason: input.reason,
          override_by: user?.id,
          override_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  // Export report cards
  export: () => ({
    mutationFn: async (input: ExportReportCardsInput) => {
      const supabase = getSupabaseClient();

      // Fetch report cards data
      let query = supabase
        .from('report_cards')
        .select(`
          *,
          student:students(first_name, last_name, matricule),
          class:classes(name),
          period:periods(name)
        `)
        .eq('period_id', input.periodId);

      if (input.classId) {
        query = query.eq('class_id', input.classId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Convert to CSV or Excel format
      if (input.format === 'csv') {
        const csv = convertToCSV(data);
        return new Blob([csv], { type: 'text/csv' });
      } else {
        // Use xlsx library for Excel export
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Bulletins');
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        return new Blob([excelBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
      }
    },
  }),

  // Delete report card
  delete: () => ({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('report_cards')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id };
    },
  }),

  // Generate signed URL for PDF download
  getSignedUrl: () => ({
    mutationFn: async (reportCardId: string) => {
      const supabase = getSupabaseClient();

      // Get the report card with payment status
      const { data: reportCard, error: cardError } = await supabase
        .from('report_cards')
        .select('pdf_url, student_id, payment_status, payment_status_override')
        .eq('id', reportCardId)
        .single();

      if (cardError || !reportCard?.pdf_url) {
        throw new Error('Report card not found or no PDF available');
      }

      // Check document access
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('Utilisateur non authentifie');
      }

      const { data: accessCheck, error: accessError } = await supabase.functions.invoke(
        'check-document-access',
        {
          body: {
            documentType: 'report_card',
            documentId: reportCardId,
            studentId: reportCard.student_id,
          },
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'x-user-token': accessToken,
          },
        }
      );

      if (accessError) {
        throw new Error('Failed to verify document access');
      }

      if (!accessCheck.accessGranted) {
        throw new Error(
          accessCheck.denialReason ||
          'Accès bloqué en raison d\'arriérés de paiement. Veuillez contacter l\'administration.'
        );
      }

      // Generate signed URL valid for 1 hour
      const { data, error } = await supabase.storage
        .from('report-cards')
        .createSignedUrl(reportCard.pdf_url, 3600);

      if (error) throw error;
      return {
        signedUrl: data.signedUrl,
        paymentStatus: accessCheck.paymentStatus,
        paymentStatusOverride: accessCheck.paymentStatusOverride,
      };
    },
  }),
};

function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) return '';

  const headers = [
    'Matricule',
    'Nom',
    'Prénom',
    'Classe',
    'Période',
    'Moyenne',
    'Rang',
    'Effectif',
    'Mention',
    'Statut'
  ];

  const rows = data.map(row => [
    row.student.matricule,
    row.student.last_name,
    row.student.first_name,
    row.class.name,
    row.period.name,
    row.overall_average.toFixed(2),
    row.rank_in_class,
    row.class_size,
    row.mention || '',
    row.status
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
}
