import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const qrSigningSecret = Deno.env.get('QR_SIGNING_SECRET') || 'default-secret-key';

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 1. Authenticate User
        const rawAuthHeader =
            req.headers.get('x-user-token') ||
            req.headers.get('x-user-jwt') ||
            req.headers.get('Authorization') ||
            '';

        if (!rawAuthHeader) {
            throw new Error('Missing authorization header');
        }

        const token = rawAuthHeader.startsWith('Bearer ')
            ? rawAuthHeader.replace('Bearer ', '')
            : rawAuthHeader;

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            throw new Error('Invalid authorization token');
        }

        // 2. Parse Request
        const { qrData, signature } = await req.json();

        if (!qrData || !signature) {
            return new Response(
                JSON.stringify({ success: false, message: 'Missing qrData or signature' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 3. Verify Signature
        const verifySignature = async (data: string, secret: string, signature: string) => {
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey(
                'raw',
                encoder.encode(secret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );
            const signatureBuffer = await crypto.subtle.sign(
                'HMAC',
                key,
                encoder.encode(data)
            );
            const computedSignature = Array.from(new Uint8Array(signatureBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

            return computedSignature === signature;
        };

        // Attempt 1: Global Signing Secret (Report Cards)
        let isValid = await verifySignature(qrData, qrSigningSecret, signature);
        let usedSecretType = 'global';

        // Attempt 2: School Specific Secret (Student Cards)
        if (!isValid) {
            // We need to parse the data to get the schoolId to fetch the verification secret
            let parsedPayload;
            try {
                parsedPayload = JSON.parse(qrData);
            } catch (e) { /* ignore */ }

            if (parsedPayload?.schoolId) {
                const { data: schoolData } = await supabase
                    .from('schools')
                    .select('settings')
                    .eq('id', parsedPayload.schoolId)
                    .single();

                const schoolSecret = (schoolData?.settings as any)?.qrSecret;

                if (schoolSecret) {
                    isValid = await verifySignature(qrData, schoolSecret, signature);
                    usedSecretType = 'school';
                }
            }
        }

        if (!isValid) {
            return new Response(
                JSON.stringify({
                    success: false,
                    message: 'Signature invalide. Ce document a peut-être été falsifié.'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 4. Parse Data
        let parsedData;
        try {
            parsedData = JSON.parse(qrData);
        } catch (e) {
            return new Response(
                JSON.stringify({ success: false, message: 'Données QR invalides (JSON incorrect).' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 5. Enrich Data
        const { data: student } = await supabase
            .from('students')
            .select('first_name, last_name, matricule')
            .eq('id', parsedData.studentId)
            .single();

        // Fetch period name if available (Report Cards)
        let periodName = 'N/A';
        if (parsedData.periodId) {
            const { data: period } = await supabase
                .from('periods')
                .select('name')
                .eq('id', parsedData.periodId)
                .single();
            periodName = period?.name || 'Période inconnue';
        }
        // Fetch class name if available (Student Cards might have cardId but no period)
        // Student cards usually don't verify period, but we can try to fetch class if we wanted.
        // For now, prompt is simple.

        const docType = parsedData.type === 'report_card' ? 'Bulletin Scolaire' :
            (parsedData.cardId ? 'Carte Étudiant' :
                (parsedData.type || 'Document Inconnu'));

        const displayData = {
            ...parsedData,
            type: docType,
            studentName: student ? `${student.first_name} ${student.last_name}` : 'Étudiant inconnu',
            matricule: student?.matricule || parsedData.matricule || 'N/A',
            periodName: periodName,
            verifiedAt: new Date().toISOString(),
            verificationMethod: usedSecretType
        };

        return new Response(
            JSON.stringify({
                success: true,
                valid: true,
                data: displayData,
                message: 'Document authentique vérifier avec succès.'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('Error verifying QR:', error);
        return new Response(
            JSON.stringify({ success: false, message: error.message || 'Internal Server Error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
