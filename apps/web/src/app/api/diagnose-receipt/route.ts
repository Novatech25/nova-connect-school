import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@novaconnect/data/client/server";
import { getSupabaseClient } from "@novaconnect/data";

export async function GET(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseClient();

    // Récupérer les informations de diagnostic
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      environment: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
      }
    };

    // Vérifier les paiements
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('id, amount, payment_date, payment_method')
      .limit(5);

    if (paymentsError) {
      diagnostics.paymentsError = paymentsError.message;
    } else {
      diagnostics.paymentsCount = payments?.length || 0;
      diagnostics.recentPayments = payments?.map(p => ({
        id: p.id.substring(0, 8) + '...',
        amount: p.amount,
        date: p.payment_date,
      }));
    }

    // Tester la connexion à l'Edge Function
    if (payments && payments.length > 0) {
      const testPaymentId = payments[0].id;

      try {
        console.log('Testing Edge Function with payment:', testPaymentId);

        const { data: edgeFunctionResult, error: edgeFunctionError } = await supabase.functions.invoke('generate-payment-receipt', {
          body: { paymentId: testPaymentId }
        });

        if (edgeFunctionError) {
          diagnostics.edgeFunctionTest = {
            success: false,
            error: edgeFunctionError,
            message: edgeFunctionError.message,
            status: edgeFunctionError.status,
            context: edgeFunctionError.context,
          };
        } else {
          diagnostics.edgeFunctionTest = {
            success: true,
            result: edgeFunctionResult,
            hasSignedUrl: !!edgeFunctionResult?.signedUrl,
          };
        }
      } catch (error: any) {
        diagnostics.edgeFunctionTest = {
          success: false,
          error: error?.message || 'Unknown error',
          stack: error?.stack?.substring(0, 200) + '...',
        };
      }
    }

    return NextResponse.json(diagnostics);
  } catch (error: any) {
    console.error('Diagnostic error:', error);
    return NextResponse.json(
      { error: error.message || 'Diagnostic failed' },
      { status: 500 }
    );
  }
}
