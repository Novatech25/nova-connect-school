import { z } from 'zod';

// GPS Configuration Schema
export const gpsConfigSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().positive().default(200),
  requireWifiLan: z.boolean().default(false),
  wifiSsid: z.string().optional(),
});

// QR Attendance Configuration Schema
export const qrAttendanceConfigSchema = z.object({
  enabled: z.boolean().default(false),
  qrValidityMinutes: z.number().int().positive().default(5),
  qrRotationMinutes: z.number().int().positive().default(10),
  enableAntiFraud: z.boolean().default(true),
  requireGpsValidation: z.boolean().default(true),
  maxScansPerSession: z.number().int().positive().default(1),
});

// Payment & Document Blocking Configuration Schema
export const paymentBlockingConfigSchema = z.object({
  mode: z.enum(['OK', 'WARNING', 'BLOCKED']).default('WARNING'),
  blockBulletins: z.boolean().default(true),
  blockCertificates: z.boolean().default(true),
  blockStudentCards: z.boolean().default(false),
  blockExamAuthorizations: z.boolean().default(true),
  warningThresholdPercent: z.number().min(0).max(100).default(50),
});

// Attendance Fusion Configuration Schema
export const attendanceFusionConfigSchema = z.object({
  enabled: z.boolean().default(true),
  strategy: z.enum(['teacher_priority', 'qr_priority', 'coexist']).default('teacher_priority'),
  qrTimeWindowMinutes: z.number().min(5).max(60).default(15),
  autoMerge: z.boolean().default(true),
  notifyOnConflict: z.boolean().default(true),
});

// Dynamic Room Assignment Configuration Schema
export const dynamicRoomAssignmentConfigSchema = z.object({
  enabled: z.boolean().default(false),

  // Priorité de sélection
  selectionPriority: z.enum(['capacity', 'size_category']).default('capacity'),

  // Marge de sécurité
  capacityMarginPercent: z.number().min(0).max(100).default(10),

  // Règles de conflits
  conflictResolution: z.enum(['largest_room', 'split_classes', 'manual_fallback']).default('largest_room'),

  // Fenêtre de notification
  notificationWindows: z.object({
    firstNotificationMinutes: z.number().int().positive().default(60), // T-60
    reminderNotificationMinutes: z.number().int().positive().default(15), // T-15
  }),

  // Canaux de notification
  notificationChannels: z.object({
    inApp: z.boolean().default(true),
    push: z.boolean().default(true),
    email: z.boolean().default(false),
    sms: z.boolean().default(false),
  }),

  // Options avancées
  includeFloorPlan: z.boolean().default(false), // Plan d'accès dans notification
  autoRecalculateOnChange: z.boolean().default(true), // Recalcul auto si EDT modifié
});

// Canteen Meal Service Schema
export const canteenMealServiceSchema = z.object({
  name: z.string().min(1, 'Le nom du service est requis'),
  enabled: z.boolean().default(true),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM requis').default('12:00'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM requis').default('13:30'),
  defaultPrice: z.number().min(0).default(0),
});

// Canteen Configuration Schema
export const canteenConfigSchema = z.object({
  // Activation
  enabled: z.boolean().default(false),
  serviceMode: z.enum(['self_service', 'preorder', 'mixed']).default('self_service'),

  // Meal services
  mealServices: z.array(canteenMealServiceSchema).default([
    { name: 'Petit-déjeuner', enabled: false, startTime: '07:00', endTime: '08:30', defaultPrice: 0 },
    { name: 'Déjeuner', enabled: true, startTime: '12:00', endTime: '13:30', defaultPrice: 0 },
    { name: 'Goûter', enabled: false, startTime: '16:00', endTime: '16:30', defaultPrice: 0 },
  ]),

  // Tarification
  currency: z.string().default('XAF'),
  defaultMealPrice: z.number().min(0).default(500),
  staffDiscountPercent: z.number().min(0).max(100).default(0),
  scholarshipDiscountPercent: z.number().min(0).max(100).default(0),

  // Allergies & régimes
  trackAllergies: z.boolean().default(false),
  availableDiets: z.array(z.string()).default([
    'Végétarien',
    'Halal',
    'Sans gluten',
    'Sans lactose',
  ]),

  // Capacité & créneaux
  maxCapacity: z.number().int().min(0).default(200),
  slotDurationMinutes: z.number().int().min(5).max(120).default(30),
  allowSecondServing: z.boolean().default(false),

  // Notifications
  notifyParentsOnAbsence: z.boolean().default(false),
  notifyLowBalance: z.boolean().default(false),
  lowBalanceThreshold: z.number().min(0).default(1000),
});

// Payment Reminders Configuration Schema
export const paymentRemindersConfigSchema = z.object({
  enabled: z.boolean().default(true),
  cooldownDays: z.number().int().min(1).max(30).default(7),
  autoEscalate: z.boolean().default(true),
  channels: z.array(z.enum(['in_app', 'push', 'email', 'sms'])).default(['in_app', 'push']),
  messageTemplates: z.object({
    first: z.string().default(
      'Bonjour {student_name}, ce rappel aimable pour vous informer que vous avez une facture impayée de {amount} pour {fee_name} (échéance: {due_date}). Merci de régulariser votre situation.'
    ),
    second: z.string().default(
      'RAPPEL: {student_name}, vous avez toujours un paiement en retard de {amount} pour {fee_name}. Échéance dépassée depuis {days_overdue} jours. Veuillez contacter la comptabilité.'
    ),
    final: z.string().default(
      'DERNIER AVIS: Paiement en retard de {amount} pour {fee_name}. Veuillez régulariser impérativement sous peine de sanctions. Contact: {school_name}.'
    ),
  }).optional(),
});

// Complete School Settings Schema
export const schoolSettingsSchema = z.object({
  gps: gpsConfigSchema.optional(),
  qrAttendance: qrAttendanceConfigSchema.optional(),
  paymentBlocking: paymentBlockingConfigSchema.optional(),
  paymentReminders: paymentRemindersConfigSchema.optional(),
  attendanceFusion: attendanceFusionConfigSchema.optional(),
  dynamicRoomAssignment: dynamicRoomAssignmentConfigSchema.optional(),
  canteen: canteenConfigSchema.optional(),
});

// TypeScript Types
export type GpsConfig = z.infer<typeof gpsConfigSchema>;
export type QrAttendanceConfig = z.infer<typeof qrAttendanceConfigSchema>;
export type PaymentBlockingConfig = z.infer<typeof paymentBlockingConfigSchema>;
export type AttendanceFusionConfig = z.infer<typeof attendanceFusionConfigSchema>;
export type DynamicRoomAssignmentConfig = z.infer<typeof dynamicRoomAssignmentConfigSchema>;
export type PaymentRemindersConfig = z.infer<typeof paymentRemindersConfigSchema>;
export type CanteenMealService = z.infer<typeof canteenMealServiceSchema>;
export type CanteenConfig = z.infer<typeof canteenConfigSchema>;
export type SchoolSettings = z.infer<typeof schoolSettingsSchema>;
