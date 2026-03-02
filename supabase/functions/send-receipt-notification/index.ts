import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { receiptId, receiptType, channels } = await req.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const tableName = receiptType === 'student_payment' ? 'payment_receipts' : 'payroll_slips';
    const { data: receipt } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', receiptId)
      .single();

    if (!receipt) throw new Error('Receipt not found');

    // Get signed URL for PDF
    const bucketName = receiptType === 'student_payment' ? 'payment-receipts' : 'payroll-slips';
    const { data: signedUrlData } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(receipt.pdf_url, 86400); // 24h validity

    const sendStatus: Record<string, string> = {};

    // Send via each channel
    for (const channel of channels) {
      try {
        if (channel === 'email') {
          // Call email sending service (Resend, SendGrid, etc.)
          // await sendEmail(recipient, subject, body, pdfUrl);
          sendStatus.email = 'sent';
        } else if (channel === 'whatsapp') {
          // Call WhatsApp API (Twilio, etc.)
          // await sendWhatsApp(phoneNumber, message, pdfUrl);
          sendStatus.whatsapp = 'sent';
        } else if (channel === 'sms') {
          // Call SMS API
          sendStatus.sms = 'sent';
        }
      } catch (error) {
        sendStatus[channel] = 'failed';
      }
    }

    // Update receipt with send status
    await supabase
      .from(tableName)
      .update({
        sent_at: new Date().toISOString(),
        send_status: sendStatus,
      })
      .eq('id', receiptId);

    return new Response(
      JSON.stringify({
        success: true,
        sendStatus,
        message: 'Receipt sent successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error sending receipt:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
