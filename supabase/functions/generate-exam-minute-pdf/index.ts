import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';
import { requireExamModeAccess } from '../_shared/examModuleCheck.ts';
import { jsPDF } from 'https://esm.sh/jspdf@2.5.1';

interface GenerateExamMinuteRequest {
  minuteId: string;
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

    if (!userData || !['school_admin', 'supervisor'].includes(userData.role)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check premium access
    await requireExamModeAccess(supabase, userData.school_id);

    const { minuteId }: GenerateExamMinuteRequest = await req.json();

    // Fetch minute data
    const { data: minute, error: minuteError } = await supabase
      .from('exam_minutes')
      .select(`
        *,
        exam_sessions(*),
        exam_deliberations(*, exam_juries(*))
      `)
      .eq('id', minuteId)
      .eq('school_id', userData.school_id)
      .single();

    if (minuteError || !minute) {
      throw new Error('Exam minute not found');
    }

    // Fetch school data
    const { data: school } = await supabase
      .from('schools')
      .select('*')
      .eq('id', userData.school_id)
      .single();

    // Generate PDF
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.text(school?.name || 'École', 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text('PROCÈS-VERBAL', 105, 30, { align: 'center' });
    doc.setFontSize(12);
    doc.text(minute.title, 105, 40, { align: 'center' });

    // Session info
    let yPos = 55;
    doc.setFontSize(10);
    doc.text(`Session: ${minute.exam_sessions?.name || ''}`, 20, yPos);
    yPos += 7;
    doc.text(`Type: ${minute.minute_type}`, 20, yPos);
    yPos += 7;
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 20, yPos);
    yPos += 15;

    // Content
    doc.setFontSize(10);
    const contentLines = doc.splitTextToSize(minute.content, 170);
    doc.text(contentLines, 20, yPos);
    yPos += contentLines.length * 5 + 15;

    // Signatures section
    if (minute.signatures && minute.signatures.length > 0) {
      doc.setFontSize(12);
      doc.text('Signatures:', 20, yPos);
      yPos += 10;

      minute.signatures.forEach((sig: any) => {
        doc.setFontSize(10);
        doc.text(`${sig.role}: ${sig.signed_at ? 'Signé le ' + new Date(sig.signed_at).toLocaleDateString('fr-FR') : 'Non signé'}`, 20, yPos);
        yPos += 7;
      });
    }

    // Convert to buffer
    const pdfBuffer = doc.output('arraybuffer');
    const pdfBlob = new Uint8Array(pdfBuffer);

    // Upload to storage
    const fileName = `${userData.school_id}/${minute.exam_session_id}/${minuteId}_${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('exam-documents')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Update minute record
    const { data: updatedMinute, error: updateError } = await supabase
      .from('exam_minutes')
      .update({
        pdf_url: fileName,
        pdf_size_bytes: pdfBlob.length,
        status: 'validated'
      })
      .eq('id', minuteId)
      .select()
      .single();

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        minute: updatedMinute,
        message: 'Exam minute PDF generated successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error generating exam minute PDF:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
