import { getSupabaseClient } from '../client';
import { snakeToCamelKeys, camelToSnakeKeys } from '../helpers';
import type { StudentDocument } from '@novaconnect/core';

export const studentDocumentQueries = {
  /**
   * Get signed URL for student document download with payment check
   */
  getSignedUrl: () => ({
    mutationFn: async (documentId: string, studentId: string) => {
      const supabase = getSupabaseClient();

      // Get the document
      const { data: document, error: docError } = await supabase
        .from('student_documents')
        .select('id, file_url, student_id, document_type, school_id')
        .eq('id', documentId)
        .single();

      if (docError || !document?.file_url) {
        throw new Error('Document not found');
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
            documentType: document.document_type === 'transcript' ? 'report_card' : document.document_type,
            documentId: document.id,
            studentId: studentId,
          },
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''}`,
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
        .from('documents')
        .createSignedUrl(document.file_url, 3600);

      if (error) throw error;
      return {
        signedUrl: data.signedUrl,
        paymentStatus: accessCheck.paymentStatus,
        paymentStatusOverride: accessCheck.paymentStatusOverride,
      };
    },
  }),

  /**
   * Get student documents for a student
   */
  getByStudent: (studentId: string) => ({
    queryKey: ['student_documents', studentId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('student_documents')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map(d => snakeToCamelKeys(d)) as StudentDocument[];
    },
  }),

  /**
   * Upload a document for a student
   */
  upload: () => ({
    mutationFn: async (input: {
      studentId: string;
      schoolId: string;
      documentType: string;
      title: string;
      description?: string;
      file: File;
    }) => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      // Generate unique file path using user ID (auth.uid()) for RLS policy
      const fileExt = input.file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${input.schoolId}/${user.id}/${input.documentType}/${fileName}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, input.file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Erreur lors du téléversement: ${uploadError.message}`);
      }

      // Insert document record in database
      const { data: documentData, error: dbError } = await supabase
        .from('student_documents')
        .insert({
          school_id: input.schoolId,
          student_id: input.studentId,
          document_type: input.documentType,
          title: input.title,
          description: input.description || null,
          file_url: filePath,
          file_name: input.file.name,
          file_size: input.file.size,
          mime_type: input.file.type,
          uploaded_by: user.id,
          metadata: {
            originalFileName: input.file.name,
            uploadedVia: 'student_portal',
          },
        })
        .select()
        .single();

      if (dbError) {
        // If database insert fails, delete the uploaded file
        await supabase.storage.from('documents').remove([filePath]);
        throw new Error(`Erreur lors de l'enregistrement: ${dbError.message}`);
      }

      return snakeToCamelKeys(documentData) as StudentDocument;
    },
  }),

  /**
   * Delete a student document
   */
  delete: () => ({
    mutationFn: async (documentId: string) => {
      const supabase = getSupabaseClient();

      // Get document to delete file from storage
      const { data: document, error: fetchError } = await supabase
        .from('student_documents')
        .select('file_url')
        .eq('id', documentId)
        .single();

      if (fetchError) throw fetchError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('student_documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      // Delete file from storage
      if (document?.file_url) {
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([document.file_url]);

        if (storageError) {
          console.warn('Failed to delete file from storage:', storageError);
        }
      }

      return { success: true };
    },
  }),
};
