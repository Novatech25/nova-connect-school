import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const studentId = req.nextUrl.searchParams.get('studentId');
  const periodId = req.nextUrl.searchParams.get('periodId');

  if (!id && (!studentId || !periodId)) {
    return NextResponse.json(
      { success: false, message: 'Missing id or studentId/periodId' },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { success: false, message: 'Server misconfigured' },
      { status: 500 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    let query = supabase
      .from('report_cards')
      .select(
        `
        id,
        status,
        overall_average,
        rank_in_class,
        class_size,
        mention,
        mention_color,
        generated_at,
        published_at,
        student:students(id, first_name, last_name, matricule),
        class:classes(id, name),
        period:periods(id, name),
        school:schools(id, name, address, city, country, phone, email, logo_url)
      `
      );

    if (id) {
      query = query.eq('id', id);
    } else {
      query = query.eq('student_id', studentId).eq('period_id', periodId);
      query = query.order('created_at', { ascending: false }).limit(1);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) {
      return NextResponse.json(
        { success: false, message: 'Report card not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      reportCard: data,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Verification failed' },
      { status: 500 }
    );
  }
}
