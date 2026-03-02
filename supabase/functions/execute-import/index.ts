import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireImportApiAccess } from "../_shared/importModuleCheck.ts";

serve(async (req) => {
  try {
    const { importJobId } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get import job
    const { data: importJob, error: jobError } = await supabaseClient
      .from('import_jobs')
      .select('*')
      .eq('id', importJobId)
      .single();

    if (jobError || !importJob) {
      return new Response(
        JSON.stringify({ error: 'Import job not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (importJob.status !== 'previewing') {
      return new Response(
        JSON.stringify({ error: 'Import job must be in previewing status' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check premium access
    await requireImportApiAccess(supabaseClient, importJob.school_id);

    // Update status to importing
    await supabaseClient
      .from('import_jobs')
      .update({ status: 'importing' })
      .eq('id', importJobId);

    // Parse the file again to get data (in production, cache this)
    const { data: fileData } = await supabaseClient.storage
      .from('imports')
      .download(importJob.file_path!);

    if (!fileData) {
      throw new Error('Failed to download file');
    }

    // Parse file based on extension (support both CSV and Excel)
    const fileExtension = importJob.file_name!.split('.').pop()?.toLowerCase();
    let parsedData: any[] = [];

    if (fileExtension === 'csv') {
      const csvText = await fileData.text();
      const lines = csvText.split('\n').filter(line => line.trim());
      const delimiter = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';

      const columns = lines[0].split(delimiter).map(col => col.trim().replace(/^"|"$/g, ''));

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter).map(val => val.trim().replace(/^"|"$/g, ''));
        const row: any = {};
        columns.forEach((col, index) => {
          row[col] = values[index] || '';
        });
        parsedData.push(row);
      }
    } else if (['xlsx', 'xls'].includes(fileExtension)) {
      // Parse Excel using xlsx library
      const XLSX = await import('https://cdn.skypack.dev/xlsx@0.18.5');
      const arrayBuffer = await fileData.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length > 0) {
        const columns = jsonData[0].map((col: any) => String(col).trim());

        for (let i = 1; i < jsonData.length; i++) {
          const row: any = {};
          const values = jsonData[i];

          for (let j = 0; j < columns.length; j++) {
            row[columns[j]] = values[j] !== undefined ? String(values[j]).trim() : '';
          }

          if (Object.values(row).some(val => val !== '')) {
            parsedData.push(row);
          }
        }
      }
    }

    let importedRows = 0;
    let invalidRows = 0;
    const executionErrors: any[] = [];

    // Process rows based on import type
    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i];
      const rowNum = i + 2;

      try {
        if (importJob.import_type === 'students') {
          await importStudentRow(row, importJob, rowNum, supabaseClient);
        } else if (importJob.import_type === 'grades') {
          await importGradeRow(row, importJob, rowNum, supabaseClient);
        } else if (importJob.import_type === 'schedules') {
          await importScheduleRow(row, importJob, rowNum, supabaseClient);
        }
        importedRows++;
      } catch (error: any) {
        console.error(`Error importing row ${rowNum}:`, error);
        executionErrors.push({
          row: rowNum,
          field: error.field || 'unknown',
          message: error.message || 'Import failed',
          value: error.value || row
        });
        invalidRows++;
      }
    }

    // Update import job as completed with execution errors
    const { error: updateError } = await supabaseClient
      .from('import_jobs')
      .update({
        status: 'completed',
        imported_rows: importedRows,
        invalid_rows: invalidRows,
        completed_at: new Date().toISOString(),
        can_rollback: importedRows > 0,
        validation_errors: executionErrors
      })
      .eq('id', importJobId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        importedRows,
        invalidRows
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error executing import:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function importStudentRow(row: any, importJob: any, rowNum: number, supabaseClient: any) {
  // Map row data using column_mapping
  const mappedRow = mapRowData(row, importJob.column_mapping);

  // Generate matricule if not provided (await the Promise)
  if (!mappedRow.matricule) {
    mappedRow.matricule = await generateMatricule(importJob.school_id, supabaseClient);
  }

  // Resolve classId if className provided
  if (mappedRow.className && !mappedRow.classId) {
    const { data: classData } = await supabaseClient
      .from('classes')
      .select('id')
      .eq('name', mappedRow.className)
      .eq('school_id', importJob.school_id)
      .single();

    mappedRow.classId = classData?.id;
  }

  // Insert student
  const { data: student } = await supabaseClient
    .from('students')
    .insert({
      school_id: importJob.school_id,
      matricule: mappedRow.matricule,
      first_name: mappedRow.firstName,
      last_name: mappedRow.lastName,
      date_of_birth: mappedRow.dateOfBirth || null,
      gender: mappedRow.gender || null,
      email: mappedRow.email || null,
      phone: mappedRow.phone || null,
      address: mappedRow.address || null,
      city: mappedRow.city || null,
      place_of_birth: mappedRow.placeOfBirth || null,
      nationality: mappedRow.nationality || null,
    })
    .select('id')
    .single();

  // Create enrollment if classId provided
  if (mappedRow.classId) {
    await supabaseClient
      .from('enrollments')
      .insert({
        student_id: student.id,
        class_id: mappedRow.classId,
        status: mappedRow.status || 'active',
        enrollment_date: new Date().toISOString()
      });
  }

  // Record in import_history
  await supabaseClient
    .from('import_history')
    .insert({
      import_job_id: importJob.id,
      school_id: importJob.school_id,
      entity_type: 'student',
      entity_id: student.id,
      action: 'created',
      row_number: rowNum,
      data: mappedRow,
      original_data: null,
      new_data: student,
      status: 'completed',
      error_message: null
    });
}

async function importGradeRow(row: any, importJob: any, rowNum: number, supabaseClient: any) {
  const mappedRow = mapRowData(row, importJob.column_mapping);

  // Resolve references
  let studentId: string | null = null;
  if (mappedRow.studentMatricule) {
    const { data: student } = await supabaseClient
      .from('students')
      .select('id')
      .eq('school_id', importJob.school_id)
      .or(`matricule.eq.${mappedRow.studentMatricule},id.eq.${mappedRow.studentMatricule}`)
      .maybeSingle();

    studentId = student?.id;
  }

  let subjectId: string | null = null;
  if (mappedRow.subjectCode) {
    const { data: subject } = await supabaseClient
      .from('subjects')
      .select('id')
      .eq('school_id', importJob.school_id)
      .or(`code.eq.${mappedRow.subjectCode},id.eq.${mappedRow.subjectCode}`)
      .maybeSingle();

    subjectId = subject?.id;
  }

  // Resolve period if periodName provided
  let periodId: string | null = null;
  if (mappedRow.periodName) {
    const { data: period } = await supabaseClient
      .from('periods')
      .select('id')
      .eq('school_id', importJob.school_id)
      .or(`name.eq.${mappedRow.periodName},id.eq.${mappedRow.periodName}`)
      .maybeSingle();

    periodId = period?.id;

    if (!periodId) {
      const error: any = new Error(`Period not found: ${mappedRow.periodName}`);
      error.field = 'periodName';
      error.value = mappedRow.periodName;
      throw error;
    }
  }

  if (!studentId) {
    const error: any = new Error(`Student not found: ${mappedRow.studentMatricule}`);
    error.field = 'studentMatricule';
    error.value = mappedRow.studentMatricule;
    throw error;
  }

  if (!subjectId) {
    const error: any = new Error(`Subject not found: ${mappedRow.subjectCode}`);
    error.field = 'subjectCode';
    error.value = mappedRow.subjectCode;
    throw error;
  }

  // Insert grade with status 'draft'
  const score = typeof mappedRow.score === 'string' ? parseFloat(mappedRow.score) : mappedRow.score;
  const maxScore = typeof mappedRow.maxScore === 'string' ? parseFloat(mappedRow.maxScore) : mappedRow.maxScore;

  const { data: grade } = await supabaseClient
    .from('grades')
    .insert({
      student_id: studentId,
      subject_id: subjectId,
      period_id: periodId,
      class_id: null, // Can be resolved if needed
      grade_type: mappedRow.gradeType,
      title: mappedRow.title,
      score: score,
      max_score: maxScore,
      coefficient: mappedRow.coefficient || 1,
      weight: mappedRow.weight || 1,
      comments: mappedRow.comments || null,
      graded_date: mappedRow.gradedDate || new Date().toISOString(),
      status: 'draft'
    })
    .select('id')
    .single();

  await supabaseClient
    .from('import_history')
    .insert({
      import_job_id: importJob.id,
      school_id: importJob.school_id,
      entity_type: 'grade',
      entity_id: grade.id,
      action: 'created',
      row_number: rowNum,
      data: mappedRow,
      original_data: null,
      new_data: grade,
      status: 'completed',
      error_message: null
    });
}

async function importScheduleRow(row: any, importJob: any, rowNum: number, supabaseClient: any) {
  const mappedRow = mapRowData(row, importJob.column_mapping);

  // Resolve class
  let classId: string | null = null;
  if (mappedRow.className) {
    const { data: classData } = await supabaseClient
      .from('classes')
      .select('id')
      .eq('school_id', importJob.school_id)
      .or(`name.eq.${mappedRow.className},id.eq.${mappedRow.className}`)
      .maybeSingle();

    classId = classData?.id;

    if (!classId) {
      const error: any = new Error(`Class not found: ${mappedRow.className}`);
      error.field = 'className';
      error.value = mappedRow.className;
      throw error;
    }
  }

  // Resolve subject
  let subjectId: string | null = null;
  if (mappedRow.subjectCode) {
    const { data: subject } = await supabaseClient
      .from('subjects')
      .select('id')
      .eq('school_id', importJob.school_id)
      .or(`code.eq.${mappedRow.subjectCode},id.eq.${mappedRow.subjectCode}`)
      .maybeSingle();

    subjectId = subject?.id;

    if (!subjectId) {
      const error: any = new Error(`Subject not found: ${mappedRow.subjectCode}`);
      error.field = 'subjectCode';
      error.value = mappedRow.subjectCode;
      throw error;
    }
  }

  // Resolve teacher
  let teacherId: string | null = null;
  if (mappedRow.teacherEmail) {
    const { data: teacher } = await supabaseClient
      .from('users')
      .select('id')
      .eq('school_id', importJob.school_id)
      .eq('email', mappedRow.teacherEmail)
      .maybeSingle();

    teacherId = teacher?.id;

    if (!teacherId) {
      const error: any = new Error(`Teacher not found: ${mappedRow.teacherEmail}`);
      error.field = 'teacherEmail';
      error.value = mappedRow.teacherEmail;
      throw error;
    }
  }

  // Resolve room
  let roomId: string | null = null;
  if (mappedRow.roomName) {
    const { data: room } = await supabaseClient
      .from('rooms')
      .select('id')
      .eq('school_id', importJob.school_id)
      .or(`name.eq.${mappedRow.roomName},id.eq.${mappedRow.roomName}`)
      .maybeSingle();

    roomId = room?.id;

    if (!roomId) {
      const error: any = new Error(`Room not found: ${mappedRow.roomName}`);
      error.field = 'roomName';
      error.value = mappedRow.roomName;
      throw error;
    }
  }

  // Resolve campus
  let campusId: string | null = null;
  if (mappedRow.campusName) {
    const { data: campus } = await supabaseClient
      .from('campuses')
      .select('id')
      .eq('school_id', importJob.school_id)
      .or(`name.eq.${mappedRow.campusName},id.eq.${mappedRow.campusName}`)
      .maybeSingle();

    campusId = campus?.id;

    if (!campusId) {
      const error: any = new Error(`Campus not found: ${mappedRow.campusName}`);
      error.field = 'campusName';
      error.value = mappedRow.campusName;
      throw error;
    }
  }

  // Validate day of week
  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayOfWeek = mappedRow.dayOfWeek;
  if (!validDays.includes(dayOfWeek)) {
    const error: any = new Error(`Invalid day of week: ${dayOfWeek}`);
    error.field = 'dayOfWeek';
    error.value = dayOfWeek;
    throw error;
  }

  // Validate time format
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(mappedRow.startTime)) {
    const error: any = new Error(`Invalid start time format: ${mappedRow.startTime}`);
    error.field = 'startTime';
    error.value = mappedRow.startTime;
    throw error;
  }

  if (!timeRegex.test(mappedRow.endTime)) {
    const error: any = new Error(`Invalid end time format: ${mappedRow.endTime}`);
    error.field = 'endTime';
    error.value = mappedRow.endTime;
    throw error;
  }

  // Check for scheduling conflicts
  if (classId && teacherId) {
    const { data: conflicts } = await supabaseClient
      .from('schedule_slots')
      .select('id')
      .eq('school_id', importJob.school_id)
      .eq('day_of_week', dayOfWeek)
      .or(`and(class_id.eq.${classId},teacher_id.eq.${teacherId})`)
      .gte('start_time', mappedRow.startTime)
      .lt('start_time', mappedRow.endTime);

    if (conflicts && conflicts.length > 0) {
      const error: any = new Error(`Scheduling conflict detected for class and teacher at this time`);
      error.field = 'startTime';
      error.value = mappedRow.startTime;
      throw error;
    }
  }

  // Insert schedule slot
  const { data: slot } = await supabaseClient
    .from('schedule_slots')
    .insert({
      school_id: importJob.school_id,
      class_id: classId,
      subject_id: subjectId,
      teacher_id: teacherId,
      room_id: roomId,
      campus_id: campusId,
      day_of_week: dayOfWeek,
      start_time: mappedRow.startTime,
      end_time: mappedRow.endTime,
      semester: mappedRow.semester || null,
      academic_year: mappedRow.academicYear || null,
      is_recurring: mappedRow.isRecurring !== false, // default to true
      notes: mappedRow.notes || null
    })
    .select('id')
    .single();

  // Record in import_history
  await supabaseClient
    .from('import_history')
    .insert({
      import_job_id: importJob.id,
      school_id: importJob.school_id,
      entity_type: 'schedule_slot',
      entity_id: slot.id,
      action: 'created',
      row_number: rowNum,
      data: mappedRow,
      original_data: null,
      new_data: slot,
      status: 'completed',
      error_message: null
    });
}

function mapRowData(row: any, columnMapping: Record<string, string>): any {
  const mapped: any = {};

  Object.entries(columnMapping).forEach(([sourceCol, targetField]) => {
    mapped[targetField] = row[sourceCol];
  });

  return mapped;
}

async function generateMatricule(schoolId: string, supabaseClient: any): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const { count } = await supabaseClient
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('school_id', schoolId);

  const sequence = (count || 0) + 1;
  return `${schoolId.slice(0, 3).toUpperCase()}${year}${sequence.toString().padStart(4, '0')}`;
}
