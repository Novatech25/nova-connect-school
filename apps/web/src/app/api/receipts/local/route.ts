import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@novaconnect/data/client/server";
import { getSupabaseClient } from "@novaconnect/data";

export async function POST(req: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { paymentId } = await req.json();

    if (!paymentId) {
      return NextResponse.json({ error: "paymentId is required" }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 1. Récupérer le paiement avec les relations
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select(`
        *,
        students(id, first_name, last_name, matricule),
        fee_schedules(*, fee_types(*, schools(*)))
      `)
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      console.error('Payment not found:', paymentError);
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    const school = payment.fee_schedules?.fee_types?.schools;
    const student = payment.students;
    const feeType = payment.fee_schedules?.fee_types;

    if (!school || !student || !feeType) {
      console.error('Missing data:', { school: !!school, student: !!student, feeType: !!feeType });
      return NextResponse.json(
        { error: 'Données manquantes pour générer le reçu' },
        { status: 400 }
      );
    }

    // 2. Générer le numéro de reçu
    const year = new Date().getFullYear().toString();

    // Get the last receipt number
    const { data: lastReceipt } = await supabase
      .from('payment_receipts')
      .select('receipt_number')
      .eq('school_id', school.id)
      .like('receipt_number', `REC-${year}-%`)
      .order('receipt_number', { ascending: false })
      .limit(1)
      .single();

    let sequenceNumber = 1;
    if (lastReceipt) {
      const match = lastReceipt.receipt_number.match(/REC-\d+-(\d+)/);
      if (match) {
        sequenceNumber = parseInt(match[1], 10) + 1;
      }
    }

    const receiptNumber = `REC-${year}-${String(sequenceNumber).padStart(4, '0')}`;

    // 3. Générer un reçu simple (PDF de base)
    // Pour l'instant, retournons les données sans PDF
    const receipt = {
      id: crypto.randomUUID(),
      school_id: school.id,
      payment_id: paymentId,
      receipt_number: receiptNumber,
      student_name: `${student.first_name} ${student.last_name}`,
      student_matricule: student.matricule,
      amount: payment.amount,
      payment_method: payment.payment_method,
      payment_date: payment.payment_date,
      fee_type_name: feeType.name,
      school_name: school.name,
      generated_at: new Date().toISOString(),
      generated_by: user.id,
      cashier_name: user.email
    };

    console.log('Receipt generated (no PDF yet):', receipt);

    return NextResponse.json({
      success: true,
      receipt,
      message: 'Reçu généré avec succès'
    });

  } catch (error: any) {
    console.error('Error generating receipt:', error);
    return NextResponse.json(
      {
        error: error.message || 'Erreur lors de la génération du reçu',
        details: {
          name: error?.name,
          stack: error?.stack?.substring(0, 500)
        }
      },
      { status: 500 }
    );
  }
}
