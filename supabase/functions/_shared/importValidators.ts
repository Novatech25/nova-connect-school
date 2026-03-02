// ============================================================================
// Import Row Validation Functions
// ============================================================================
// Shared validators for different import types
// ============================================================================

import { z } from "https://deno.land/x/zod/mod.ts";

// Student row validator
const studentRowSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  matricule: z.string().optional(),
  dateOfBirth: z.string().or(z.date()).optional(),
  gender: z.enum(['M', 'F', 'Autre']).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  classId: z.string().uuid().optional(),
  className: z.string().optional(),
});

// Grade row validator
const gradeRowSchema = z.object({
  studentMatricule: z.union([z.string(), z.string().uuid()]),
  subjectCode: z.union([z.string(), z.string().uuid()]),
  periodName: z.union([z.string(), z.string().uuid()]),
  score: z.union([z.number(), z.string()]),
  maxScore: z.union([z.number(), z.string()]),
  gradeType: z.enum(['assignment', 'exam', 'quiz', 'project', 'participation', 'composition', 'homework']),
  title: z.string().min(1, "Title is required"),
});

// Schedule row validator
const scheduleRowSchema = z.object({
  dayOfWeek: z.string(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time must be in HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time must be in HH:MM format"),
  teacherEmail: z.union([z.string().email(), z.string().uuid()]),
  className: z.union([z.string(), z.string().uuid()]),
  subjectCode: z.union([z.string(), z.string().uuid()]),
});

export async function validateImportRow(
  row: any,
  importType: string,
  schoolId: string,
  supabaseClient: any
): Promise<void> {
  if (importType === 'students') {
    await validateStudentRow(row, schoolId, supabaseClient);
  } else if (importType === 'grades') {
    await validateGradeRow(row, schoolId, supabaseClient);
  } else if (importType === 'schedules') {
    await validateScheduleRow(row, schoolId, supabaseClient);
  }
}

async function validateStudentRow(row: any, schoolId: string, supabaseClient: any): Promise<void> {
  // Basic schema validation
  try {
    studentRowSchema.parse(row);
  } catch (error: any) {
    const firstError = error.issues[0];
    throw {
      field: firstError.path.join('.'),
      message: firstError.message,
      value: row[firstError.path[0]]
    };
  }

  // Check email uniqueness if provided
  if (row.email && row.email.trim()) {
    const { data: existingStudent } = await supabaseClient
      .from('students')
      .select('id')
      .eq('email', row.email)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (existingStudent) {
      throw {
        field: 'email',
        message: 'Email already exists',
        value: row.email
      };
    }
  }

  // Check matricule uniqueness if provided
  if (row.matricule && row.matricule.trim()) {
    const { data: existingStudent } = await supabaseClient
      .from('students')
      .select('id')
      .eq('matricule', row.matricule)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (existingStudent) {
      throw {
        field: 'matricule',
        message: 'Matricule already exists',
        value: row.matricule
      };
    }
  }

  // Validate class exists if className or classId provided
  const classIdentifier = row.classId || row.className;
  if (classIdentifier) {
    let classExists = false;

    if (row.classId) {
      const { data: classData } = await supabaseClient
        .from('classes')
        .select('id')
        .eq('id', row.classId)
        .eq('school_id', schoolId)
        .maybeSingle();

      classExists = !!classData;
    } else if (row.className) {
      const { data: classData } = await supabaseClient
        .from('classes')
        .select('id')
        .eq('name', row.className)
        .eq('school_id', schoolId)
        .maybeSingle();

      classExists = !!classData;
    }

    if (!classExists) {
      throw {
        field: 'classId',
        message: 'Class does not exist',
        value: classIdentifier
      };
    }
  }
}

async function validateGradeRow(row: any, schoolId: string, supabaseClient: any): Promise<void> {
  // Basic schema validation
  try {
    gradeRowSchema.parse(row);
  } catch (error: any) {
    const firstError = error.issues[0];
    throw {
      field: firstError.path.join('.'),
      message: firstError.message,
      value: row[firstError.path[0]]
    };
  }

  // Convert score and maxScore to numbers if strings
  const score = typeof row.score === 'string' ? parseFloat(row.score) : row.score;
  const maxScore = typeof row.maxScore === 'string' ? parseFloat(row.maxScore) : row.maxScore;

  if (isNaN(score) || score < 0) {
    throw {
      field: 'score',
      message: 'Score must be a valid number',
      value: row.score
    };
  }

  if (isNaN(maxScore) || maxScore <= 0) {
    throw {
      field: 'maxScore',
      message: 'Max score must be a positive number',
      value: row.maxScore
    };
  }

  if (score > maxScore) {
    throw {
      field: 'score',
      message: `Score (${score}) cannot exceed max score (${maxScore})`,
      value: row.score
    };
  }

  // Validate student exists
  const studentIdentifier = row.studentMatricule;
  if (studentIdentifier) {
    let studentExists = false;

    // Try as UUID first
    if (studentIdentifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      const { data: student } = await supabaseClient
        .from('students')
        .select('id')
        .eq('id', studentIdentifier)
        .eq('school_id', schoolId)
        .maybeSingle();

      studentExists = !!student;
    } else {
      // Try as matricule
      const { data: student } = await supabaseClient
        .from('students')
        .select('id')
        .eq('matricule', studentIdentifier)
        .eq('school_id', schoolId)
        .maybeSingle();

      studentExists = !!student;
    }

    if (!studentExists) {
      throw {
        field: 'studentMatricule',
        message: 'Student does not exist',
        value: studentIdentifier
      };
    }
  }

  // Validate subject exists
  const subjectIdentifier = row.subjectCode;
  if (subjectIdentifier) {
    let subjectExists = false;

    if (subjectIdentifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      const { data: subject } = await supabaseClient
        .from('subjects')
        .select('id')
        .eq('id', subjectIdentifier)
        .eq('school_id', schoolId)
        .maybeSingle();

      subjectExists = !!subject;
    } else {
      const { data: subject } = await supabaseClient
        .from('subjects')
        .select('id')
        .eq('code', subjectIdentifier)
        .eq('school_id', schoolId)
        .maybeSingle();

      subjectExists = !!subject;
    }

    if (!subjectExists) {
      throw {
        field: 'subjectCode',
        message: 'Subject does not exist',
        value: subjectIdentifier
      };
    }
  }
}

async function validateScheduleRow(row: any, schoolId: string, supabaseClient: any): Promise<void> {
  // Basic schema validation
  try {
    scheduleRowSchema.parse(row);
  } catch (error: any) {
    const firstError = error.issues[0];
    throw {
      field: firstError.path.join('.'),
      message: firstError.message,
      value: row[firstError.path[0]]
    };
  }

  // Validate teacher exists
  const teacherIdentifier = row.teacherEmail;
  if (teacherIdentifier) {
    let teacherExists = false;

    if (teacherIdentifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      const { data: teacher } = await supabaseClient
        .from('teachers')
        .select('id')
        .eq('id', teacherIdentifier)
        .maybeSingle();

      teacherExists = !!teacher;
    } else {
      const { data: teacher } = await supabaseClient
        .from('teachers')
        .select('id')
        .eq('email', teacherIdentifier)
        .maybeSingle();

      teacherExists = !!teacher;
    }

    if (!teacherExists) {
      throw {
        field: 'teacherEmail',
        message: 'Teacher does not exist',
        value: teacherIdentifier
      };
    }
  }

  // Validate class exists
  const classIdentifier = row.className;
  if (classIdentifier) {
    let classExists = false;

    if (classIdentifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      const { data: classData } = await supabaseClient
        .from('classes')
        .select('id')
        .eq('id', classIdentifier)
        .eq('school_id', schoolId)
        .maybeSingle();

      classExists = !!classData;
    } else {
      const { data: classData } = await supabaseClient
        .from('classes')
        .select('id')
        .eq('name', classIdentifier)
        .eq('school_id', schoolId)
        .maybeSingle();

      classExists = !!classData;
    }

    if (!classExists) {
      throw {
        field: 'className',
        message: 'Class does not exist',
        value: classIdentifier
      };
    }
  }

  // Validate subject exists
  const subjectIdentifier = row.subjectCode;
  if (subjectIdentifier) {
    let subjectExists = false;

    if (subjectIdentifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      const { data: subject } = await supabaseClient
        .from('subjects')
        .select('id')
        .eq('id', subjectIdentifier)
        .eq('school_id', schoolId)
        .maybeSingle();

      subjectExists = !!subject;
    } else {
      const { data: subject } = await supabaseClient
        .from('subjects')
        .select('id')
        .eq('code', subjectIdentifier)
        .eq('school_id', schoolId)
        .maybeSingle();

      subjectExists = !!subject;
    }

    if (!subjectExists) {
      throw {
        field: 'subjectCode',
        message: 'Subject does not exist',
        value: subjectIdentifier
      };
    }
  }

  // Validate time format and logic
  if (row.startTime >= row.endTime) {
    throw {
      field: 'startTime',
      message: 'Start time must be before end time',
      value: `${row.startTime} - ${row.endTime}`
    };
  }
}
