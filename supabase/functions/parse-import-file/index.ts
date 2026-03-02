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

    // Check premium access
    await requireImportApiAccess(supabaseClient, importJob.school_id);

    // Update status to parsing
    await supabaseClient
      .from('import_jobs')
      .update({ status: 'parsing', started_at: new Date().toISOString() })
      .eq('id', importJobId);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('imports')
      .download(importJob.file_path!);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // Parse file based on extension
    const fileExtension = importJob.file_name!.split('.').pop()?.toLowerCase();
    let parsedData: any[] = [];
    let columns: string[] = [];

    if (fileExtension === 'csv') {
      // Parse CSV
      const csvText = await fileData.text();
      const lines = csvText.split('\n').filter(line => line.trim());

      if (lines.length > 0) {
        // Detect delimiter
        const firstLine = lines[0];
        const commaCount = (firstLine.match(/,/g) || []).length;
        const semicolonCount = (firstLine.match(/;/g) || []).length;
        const delimiter = semicolonCount > commaCount ? ';' : ',';

        // Parse columns
        columns = lines[0].split(delimiter).map(col => col.trim().replace(/^"|"$/g, ''));

        // Parse rows
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(delimiter).map(val => val.trim().replace(/^"|"$/g, ''));
          const row: any = {};
          columns.forEach((col, index) => {
            row[col] = values[index] || '';
          });
          parsedData.push(row);
        }
      }
    } else if (['xlsx', 'xls'].includes(fileExtension)) {
      // Parse Excel using xlsx library
      const XLSX = await import('https://cdn.skypack.dev/xlsx@0.18.5');
      const arrayBuffer = await fileData.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      // Get first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length > 0) {
        // First row contains headers
        columns = jsonData[0].map((col: any) => String(col).trim());

        // Parse data rows
        for (let i = 1; i < jsonData.length; i++) {
          const row: any = {};
          const values = jsonData[i];

          for (let j = 0; j < columns.length; j++) {
            row[columns[j]] = values[j] !== undefined ? String(values[j]).trim() : '';
          }

          // Skip completely empty rows
          if (Object.values(row).some(val => val !== '')) {
            parsedData.push(row);
          }
        }
      }
    } else {
      throw new Error(`Unsupported file format: ${fileExtension}`);
    }

    // Detect column mapping based on import type
    const detectedMapping: Record<string, string> = detectColumnMapping(columns, importJob.import_type);

    // Validate rows
    const validationErrors: any[] = [];
    let validRows = 0;

    const { validateImportRow } = await import("../_shared/importValidators.ts");

    for (let i = 0; i < parsedData.length; i++) {
      const rawRow = parsedData[i];
      const rowNum = i + 2; // +2 because row 1 is header, and we want 1-based indexing

      // Apply column mapping to transform raw row to schema field names
      const mappedRow: any = {};
      for (const [rawColumn, dbField] of Object.entries(detectedMapping)) {
        if (rawRow[rawColumn] !== undefined) {
          mappedRow[dbField] = rawRow[rawColumn];
        }
      }

      try {
        await validateImportRow(mappedRow, importJob.import_type, importJob.school_id, supabaseClient);
        validRows++;
      } catch (error: any) {
        validationErrors.push({
          row: rowNum,
          field: error.field || 'unknown',
          message: error.message || 'Validation failed',
          value: error.value || mappedRow
        });
      }
    }

    // Update import job with results
    const { error: updateError } = await supabaseClient
      .from('import_jobs')
      .update({
        status: 'previewing',
        total_rows: parsedData.length,
        valid_rows: validRows,
        invalid_rows: validationErrors.length,
        column_mapping: detectedMapping,
        validation_errors: validationErrors
      })
      .eq('id', importJobId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        columns,
        detectedMapping,
        rows: parsedData.slice(0, 100), // Return first 100 rows for preview
        validationErrors,
        stats: {
          total: parsedData.length,
          valid: validRows,
          invalid: validationErrors.length
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error parsing import file:', error);

    // Update import job with error
    if (req.body && (await req.json()).importJobId) {
      const { importJobId } = await req.json();
      await createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
        .from('import_jobs')
        .update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', importJobId);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

function detectColumnMapping(columns: string[], importType: string): Record<string, string> {
  const mapping: Record<string, string> = {};
  const columnsLower = columns.map(c => c.toLowerCase().trim());

  if (importType === 'students') {
    // Student column mappings
    const mappings: Record<string, string[]> = {
      matricule: ['matricule', 'id', 'code'],
      firstName: ['prénom', 'firstname', 'first_name', 'nom', 'first name'],
      lastName: ['nom', 'lastname', 'last_name', 'family name', 'nom de famille'],
      dateOfBirth: ['date de naissance', 'date_of_birth', 'dob', 'birth date', 'naissance'],
      gender: ['genre', 'sex', 'sexe', 'gender'],
      placeOfBirth: ['lieu de naissance', 'place_of_birth', 'birthplace'],
      nationality: ['nationalité', 'nationality'],
      address: ['adresse', 'address'],
      city: ['ville', 'city'],
      phone: ['téléphone', 'telephone', 'phone', 'tel'],
      email: ['email', 'courriel', 'e-mail'],
      classId: ['classe', 'class', 'class_id', 'classe id'],
      status: ['statut', 'status', 'état']
    };

    Object.entries(mappings).forEach(([dbField, possibleNames]) => {
      for (const col of columnsLower) {
        if (possibleNames.some(name => col.includes(name))) {
          const originalCol = columns[columnsLower.indexOf(col)];
          mapping[originalCol] = dbField;
          break;
        }
      }
    });
  } else if (importType === 'grades') {
    // Grade column mappings
    const mappings: Record<string, string[]> = {
      studentMatricule: ['matricule', 'étudiant', 'student', 'student_id', 'élève'],
      subjectCode: ['matière', 'subject', 'subject_code', 'code matière'],
      periodName: ['période', 'period', 'period_name', 'trimestre', 'semestre'],
      score: ['note', 'score', 'marks'],
      maxScore: ['note maximale', 'max_score', 'maximum', 'barème'],
      gradeType: ['type', 'grade_type', 'type de note', 'catégorie'],
      title: ['titre', 'title', 'intitulé', 'description'],
      coefficient: ['coefficient', 'coef', 'coeff'],
      weight: ['poids', 'weight'],
      comments: ['commentaires', 'comments', 'remarques', 'notes']
    };

    Object.entries(mappings).forEach(([dbField, possibleNames]) => {
      for (const col of columnsLower) {
        if (possibleNames.some(name => col.includes(name))) {
          const originalCol = columns[columnsLower.indexOf(col)];
          mapping[originalCol] = dbField;
          break;
        }
      }
    });
  } else if (importType === 'schedules') {
    // Schedule column mappings
    const mappings: Record<string, string[]> = {
      dayOfWeek: ['jour', 'day', 'day_of_week'],
      startTime: ['heure début', 'start_time', 'start', 'début', 'heure de début'],
      endTime: ['heure fin', 'end_time', 'end', 'fin', 'heure de fin'],
      teacherEmail: ['professeur', 'teacher', 'teacher_email', 'email prof', 'enseignant'],
      className: ['classe', 'class', 'class_name', 'groupe'],
      subjectCode: ['matière', 'subject', 'subject_code', 'code matière', 'discipline'],
      roomName: ['salle', 'room', 'room_name', 'salle de classe'],
      campusName: ['campus', 'campus_name'],
      semester: ['semestre', 'semester'],
      academicYear: ['année scolaire', 'academic_year', 'année'],
      isRecurring: ['récurrent', 'recurring', 'récurrent'],
      notes: ['notes', 'remarques', 'comments']
    };

    Object.entries(mappings).forEach(([dbField, possibleNames]) => {
      for (const col of columnsLower) {
        if (possibleNames.some(name => col.includes(name))) {
          const originalCol = columns[columnsLower.indexOf(col)];
          mapping[originalCol] = dbField;
          break;
        }
      }
    });
  }

  return mapping;
}
