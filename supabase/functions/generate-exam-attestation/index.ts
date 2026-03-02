import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';
import { requireExamModeAccess } from '../_shared/examModuleCheck.ts';
import { jsPDF } from 'https://esm.sh/jspdf@2.5.1';

interface GenerateAttestationRequest {
  examResultId: string;
  documentType: 'attestation' | 'releve_notes';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) throw new Error('Invalid authorization token');

    const { data: userData } = await supabase
      .from('users')
      .select('role, school_id')
      .eq('id', user.id)
      .single();

    if (!userData || !['school_admin', 'supervisor', 'student', 'parent'].includes(userData.role)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await requireExamModeAccess(supabase, userData.school_id);

    const { examResultId, documentType }: GenerateAttestationRequest = await req.json();

    // Fetch exam result data with proper scoping
    const { data: result, error: resultError } = await supabase
      .from('exam_results')
      .select(`
        *,
        students(*, users(*)),
        exam_sessions(*),
        exam_deliberations(*)
      `)
      .eq('id', examResultId)
      .eq('school_id', userData.school_id)
      .single();

    if (resultError || !result) {
      throw new Error('Exam result not found');
    }

    // Verify access: students can only get their own, parents their children
    if (userData.role === 'student') {
      const { data: studentRecord } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .eq('id', result.student_id)
        .single();

      if (!studentRecord) {
        return new Response(
          JSON.stringify({ success: false, message: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (userData.role === 'parent') {
      const { data: parentRelation } = await supabase
        .from('student_parent_relations')
        .select('student_id')
        .eq('parent_id', user.id)
        .eq('student_id', result.student_id)
        .maybeSingle();

      if (!parentRelation) {
        return new Response(
          JSON.stringify({ success: false, message: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch school data
    const { data: school } = await supabase
      .from('schools')
      .select('*')
      .eq('id', userData.school_id)
      .single();

    // Generate PDF
    const doc = new jsPDF();

    // Header with school info
    doc.setFontSize(18);
    doc.text(school?.name || 'École', 105, 20, { align: 'center' });
    doc.setFontSize(14);

    if (documentType === 'attestation') {
      doc.text('ATTESTATION DE RÉSULTATS', 105, 35, { align: 'center' });
    } else {
      doc.text('RELEVÉ DE NOTES', 105, 35, { align: 'center' });
    }

    let yPos = 55;

    // Student info
    doc.setFontSize(12);
    doc.text(`Élève: ${result.students?.users?.first_name || ''} ${result.students?.users?.last_name || ''}`, 20, yPos);
    yPos += 10;
    doc.text(`Session: ${result.exam_sessions?.name || ''}`, 20, yPos);
    yPos += 10;
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 20, yPos);
    yPos += 20;

    if (documentType === 'attestation') {
      // Attestation content
      doc.text(`Le responsable de l'établissement certifie que l'élève`, 20, yPos);
      yPos += 10;
      doc.setFont(undefined, 'bold');
      doc.text(`${result.students?.users?.first_name} ${result.students?.users?.last_name}`, 20, yPos);
      yPos += 10;
      doc.setFont(undefined, 'normal');
      doc.text(`a participé à la session d'examen: ${result.exam_sessions?.name}`, 20, yPos);
      yPos += 10;
      doc.text(`et a obtenu les résultats suivants:`, 20, yPos);
      yPos += 15;

      doc.setFont(undefined, 'bold');
      doc.text(`Moyenne: ${result.overall_average}/20`, 20, yPos);
      yPos += 10;
      doc.text(`Rang: ${result.rankInClass || 'N/A'}/${result.classSize}`, 20, yPos);
      yPos += 10;
      doc.text(`Mention: ${result.mention || 'N/A'}`, 20, yPos);
      yPos += 10;
      doc.text(`Décision: ${result.is_passed ? 'ADMIS(E)' : 'REFUSÉ(E)'}`, 20, yPos);
      yPos += 20;

      doc.setFont(undefined, 'normal');
      doc.text(`En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.`, 20, yPos);
    } else {
      // Relevé de notes content
      doc.text('RELEVÉ DES NOTES ET RÉSULTATS', 105, yPos, { align: 'center' });
      yPos += 20;

      doc.setFont(undefined, 'bold');
      doc.text(`Moyenne générale: ${result.overall_average}/20`, 20, yPos);
      yPos += 10;
      doc.text(`Classement: ${result.rankInClass || 'N/A'}/${result.classSize}`, 20, yPos);
      yPos += 10;
      doc.text(`Mention: ${result.mention || 'N/A'}`, 20, yPos);
      yPos += 10;
      doc.setFont(undefined, 'normal');
      doc.text(`Décision du jury: ${result.is_passed ? 'ADMIS(E)' : 'REFUSÉ(E)'}`, 20, yPos);
      yPos += 20;

      if (result.juryComments) {
        doc.text('Commentaires du jury:', 20, yPos);
        yPos += 10;
        const commentLines = doc.splitTextToSize(result.juryComments, 170);
        doc.text(commentLines, 20, yPos);
        yPos += commentLines.length * 5 + 15;
      }

      if (result.specialDecision) {
        doc.setFont(undefined, 'bold');
        doc.text(`Décision spéciale: ${result.specialDecision}`, 20, yPos);
      }
    }

    // Footer
    yPos += 30;
    doc.setFontSize(10);
    doc.text(`Fait à ${school?.city || ''}, le ${new Date().toLocaleDateString('fr-FR')}`, 20, yPos);
    yPos += 10;
    doc.text('Le Directeur', 20, yPos);
    yPos += 30;
    doc.text('Signature:', 20, yPos);

    // Convert to buffer
    const pdfBuffer = doc.output('arraybuffer');
    const pdfBlob = new Uint8Array(pdfBuffer);

    // Upload to storage
    const fileName = `${userData.school_id}/attestations/${examResultId}_${documentType}_${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('exam-documents')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Generate signed URL (valid for 1 hour)
    const { data: { signedUrl } } = await supabase.storage
      .from('exam-documents')
      .createSignedUrl(fileName, 60);

    return new Response(
      JSON.stringify({
        success: true,
        downloadUrl: signedUrl,
        documentType,
        message: `Document ${documentType} généré avec succès`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error generating exam attestation:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
