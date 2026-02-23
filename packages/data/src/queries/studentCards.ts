import { camelToSnakeKeys, snakeToCamelKeys } from '../helpers';
import { getSupabaseClient } from '../client';
import type {
  CardTemplate,
  CreateCardTemplate,
  UpdateCardTemplate,
  StudentCard,
  CreateStudentCard,
  UpdateStudentCard,
  RevokeCard,
  GenerateCardBatch,
  GenerateCardPdf,
  OverrideCardPaymentStatus,
} from '@novaconnect/core';

export const cardTemplateQueries = {
  getAll: (schoolId: string) => ({
    queryKey: ['card_templates', schoolId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('card_templates')
        .select('*')
        .eq('school_id', schoolId)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getById: (id: string) => ({
    queryKey: ['card_templates', id],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('card_templates')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getDefault: (schoolId: string) => ({
    queryKey: ['card_templates', 'default', schoolId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('card_templates')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_default', true)
        .maybeSingle();
      if (error) throw error;
      return data ? snakeToCamelKeys(data) : null;
    },
  }),

  create: () => ({
    mutationFn: async (template: CreateCardTemplate) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('card_templates')
        .insert(camelToSnakeKeys(template))
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...updates }: UpdateCardTemplate) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('card_templates')
        .update(camelToSnakeKeys(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  delete: () => ({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('card_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { id };
    },
  }),
};

export const studentCardQueries = {
  getAll: (schoolId: string, filters?: { status?: string; studentId?: string }) => ({
    queryKey: ['student_cards', schoolId, filters],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      let query = supabase
        .from('student_cards')
        .select(`
          *,
          student:students(*),
          template:card_templates(*),
          generated_by_user:users!generated_by(id, first_name, last_name, email)
        `)
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.studentId) {
        query = query.eq('student_id', filters.studentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getById: (id: string) => ({
    queryKey: ['student_cards', id],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('student_cards')
        .select(`
          *,
          student:students(*, classes(*), campuses(*)),
          template:card_templates(*),
          generated_by_user:users!generated_by(id, first_name, last_name, email),
          revoked_by_user:users!revoked_by(id, first_name, last_name, email)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getByStudentId: (studentId: string) => ({
    queryKey: ['student_cards', 'student', studentId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('student_cards')
        .select(`
          *,
          template:card_templates(*)
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  getActiveByStudentId: (studentId: string) => ({
    queryKey: ['student_cards', 'active', studentId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('student_cards')
        .select(`
          *,
          template:card_templates(*)
        `)
        .eq('student_id', studentId)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      return data ? snakeToCamelKeys(data) : null;
    },
  }),

  getStatistics: (schoolId: string) => ({
    queryKey: ['student_cards', 'statistics', schoolId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('student_cards')
        .select('status')
        .eq('school_id', schoolId);

      if (error) throw error;

      const stats = {
        total: data.length,
        active: 0,
        expired: 0,
        revoked: 0,
        lost: 0,
      };

      data.forEach((card: any) => {
        if (card.status in stats) {
          stats[card.status as keyof typeof stats]++;
        }
      });

      return stats;
    },
  }),

  create: () => ({
    mutationFn: async (card: CreateStudentCard) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('student_cards')
        .insert(camelToSnakeKeys(card))
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  update: () => ({
    mutationFn: async ({ id, ...updates }: UpdateStudentCard) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('student_cards')
        .update(camelToSnakeKeys(updates))
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  generatePdf: () => ({
    mutationFn: async ({ studentId, templateId, regenerate }: GenerateCardPdf) => {
      const supabase = getSupabaseClient();

      // Get current session first, then try to refresh if needed
      let { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession?.access_token) {
        // Try to refresh if no valid session
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        if (!refreshedSession?.access_token) {
          throw new Error('No active session. Please log in again.');
        }
        currentSession = refreshedSession;
      }
      
      const accessToken = currentSession.access_token;
      if (!accessToken) {
        throw new Error('No active session. Please log in again.');
      }

      // Use internal Next.js Proxy to avoid CORS/Auth issues with Edge Functions
      // The proxy is located at apps/web/src/app/api/proxy/generate-card/route.ts
      const response = await fetch('/api/proxy/generate-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ studentId, templateId, regenerate }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Erreur HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;
    },
  }),

  generateBatch: () => ({
    mutationFn: async (batch: GenerateCardBatch) => {
      const supabase = getSupabaseClient();

      // Get current session first, then try to refresh if needed
      let { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (!currentSession?.access_token) {
        // Try to refresh if no valid session
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        if (!refreshedSession?.access_token) {
          console.error('No active session found during batch generation');
          throw new Error('No active session. Please log in again.');
        }
        currentSession = refreshedSession;
      }

      console.log('Generating cards with token:', currentSession.access_token.substring(0, 10) + '...');

      const results = [];

      for (const studentId of batch.studentIds) {
        try {
          // Use internal Next.js Proxy
          const response = await fetch('/api/proxy/generate-card', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${currentSession.access_token}`, // Pass token explicitly to proxy
            },
            body: JSON.stringify({
              studentId,
              templateId: batch.templateId,
            }),
          });

          if (!response.ok) {
             const errorData = await response.json().catch(() => ({}));
             throw new Error(errorData.details || errorData.error || `Erreur HTTP ${response.status}`);
          }

          const data = await response.json();
          results.push({ studentId, success: true, data });

        } catch (error: any) {
          console.error(`Detailed error for student ${studentId}:`, error);
          results.push({ studentId, success: false, error: error.message || 'Erreur inconnue' });
        }
      }

      return results;
    },
  }),

  revoke: () => ({
    mutationFn: async ({ cardId, reason }: RevokeCard) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('revoke-student-card', {
        body: { cardId, reason },
      });
      if (error) throw error;
      return data;
    },
  }),

  overridePaymentStatus: () => ({
    mutationFn: async ({ cardId, override, reason }: OverrideCardPaymentStatus) => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('student_cards')
        .update({
          payment_status_override: override,
          override_reason: reason,
          override_by: user?.id,
        })
        .eq('id', cardId)
        .select()
        .single();

      if (error) throw error;
      return snakeToCamelKeys(data);
    },
  }),

  downloadPdf: () => ({
    mutationFn: async (cardId: string) => {
      const supabase = getSupabaseClient();

      // Get card data
      const { data: card, error: cardError } = await supabase
        .from('student_cards')
        .select('pdf_url, student_id, school_id')
        .eq('id', cardId)
        .single();

      if (cardError) throw cardError;
      if (!card.pdf_url) throw new Error('Card PDF not generated yet');

      // Check document access
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('Utilisateur non authentifie');
      }

      const { data: accessData, error: accessError } = await supabase.functions.invoke(
        'check-document-access',
        {
          body: {
            documentType: 'student_card',
            documentId: cardId,
            studentId: card.student_id,
          },
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''}`,
            'x-user-token': accessToken,
          },
        }
      );

      if (accessError) throw accessError;
      if (!accessData.accessGranted) {
        throw new Error(accessData.denialReason || 'Access denied');
      }

      // Generate signed URL
      const { data: signedUrl, error: urlError } = await supabase.storage
        .from('student-cards')
        .createSignedUrl(card.pdf_url, 3600); // 1 hour

      if (urlError) throw urlError;
      return signedUrl;
    },
  }),
};
