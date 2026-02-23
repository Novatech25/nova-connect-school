# Report Cards System Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Workflow](#workflow)
5. [Features](#features)
6. [API Reference](#api-reference)
7. [Security and RLS](#security-and-rls)
8. [Usage Examples](#usage-examples)
9. [Integration Points](#integration-points)
10. [Future Enhancements](#future-enhancements)

---

## Overview

The Report Cards System is a comprehensive module for generating, managing, and publishing student report cards (bulletins scolaires) within the NovaConnect platform. It provides automated calculations for averages, rankings, and mentions, with support for PDF generation, versioning, and payment-based access control.

### Key Features

- **Automated Calculations**: Student averages, class rankings, and mentions based on configurable grading scales
- **PDF Generation**: Server-side PDF generation using jsPDF with customizable templates
- **Versioning**: Complete history of all report card modifications with automatic version tracking
- **Payment Integration**: Conditional access control based on payment status with admin override capability
- **Multi-Format Export**: CSV and Excel exports for statistical analysis
- **Role-Based Access**: Granular permissions for admins, teachers, students, and parents
- **Audit Logging**: Complete audit trail of all operations

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Web Admin Interface        Mobile Student/Parent Interface │
│  - Generation              - View Report Cards              │
│  - Publication             - Download PDFs                  │
│  - Management              - Check Rankings                 │
│  - Exports                 - View History                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                         API Layer                            │
├─────────────────────────────────────────────────────────────┤
│  React Query Hooks          Supabase Client                 │
│  - useReportCards          - Data fetching                  │
│  - useGenerateReportCard   - Mutations                      │
│  - usePublishReportCard    - Realtime subscriptions         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Business Logic Layer                    │
├─────────────────────────────────────────────────────────────┤
│  SQL Functions               Edge Functions                  │
│  - generate_report_card_data - generate-report-card-pdf     │
│  - calculate_class_rankings  - PDF generation               │
│  - get_mention_for_average                                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                        Data Layer                            │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL Tables           Supabase Storage               │
│  - report_cards              - PDF documents                │
│  - report_card_versions                                     │
│  - grades (existing)                                        │
│  - grading_scales (existing)                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Tables

#### report_cards

Main table storing generated report cards with calculated data and workflow status.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| school_id | UUID | Foreign key to schools |
| student_id | UUID | Foreign key to students |
| class_id | UUID | Foreign key to classes |
| period_id | UUID | Foreign key to periods |
| academic_year_id | UUID | Foreign key to academic_years |
| grading_scale_id | UUID | Foreign key to grading_scales |
| overall_average | DECIMAL(5,2) | Weighted average out of 20 |
| rank_in_class | INTEGER | Student's ranking in class |
| class_size | INTEGER | Total number of students |
| mention | VARCHAR(50) | Honor mention (e.g., "Excellent") |
| mention_color | VARCHAR(7) | Hex color for mention badge |
| subject_averages | JSONB | Array of subject averages |
| status | report_card_status_enum | draft, generated, published, archived |
| generated_at | TIMESTAMPTZ | Timestamp of generation |
| generated_by | UUID | User who generated |
| published_at | TIMESTAMPTZ | Timestamp of publication |
| published_by | UUID | User who published |
| payment_status | payment_block_status_enum | ok, warning, blocked |
| payment_status_override | BOOLEAN | Admin override flag |
| override_reason | TEXT | Reason for override |
| override_by | UUID | Admin who overrode |
| override_at | TIMESTAMPTZ | Override timestamp |
| pdf_url | TEXT | URL to PDF in storage |
| pdf_size_bytes | INTEGER | Size of PDF file |
| comments | TEXT | Additional comments |
| metadata | JSONB | Additional metadata |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**Indexes**:
- idx_report_cards_school_id
- idx_report_cards_student_id
- idx_report_cards_class_id
- idx_report_cards_period_id
- idx_report_cards_status
- idx_report_cards_payment_status
- idx_report_cards_published_at

**Constraints**:
- Unique constraint: (school_id, student_id, period_id, academic_year_id)
- CHECK: rank_in_class > 0 OR NULL
- CHECK: class_size > 0
- CHECK: overall_average BETWEEN 0 AND 20

#### report_card_versions

Version history table for tracking changes to report cards.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| report_card_id | UUID | Foreign key to report_cards |
| school_id | UUID | Foreign key to schools |
| version_number | INTEGER | Sequential version number |
| overall_average | DECIMAL(5,2) | Snapshot of average |
| rank_in_class | INTEGER | Snapshot of ranking |
| class_size | INTEGER | Snapshot of class size |
| mention | VARCHAR(50) | Snapshot of mention |
| subject_averages | JSONB | Snapshot of subject averages |
| change_reason | TEXT | Reason for change |
| changed_by | UUID | User who made change |
| changed_at | TIMESTAMPTZ | Change timestamp |
| pdf_url | TEXT | URL to PDF for this version |
| metadata | JSONB | Additional metadata |

**Indexes**:
- idx_report_card_versions_report_card_id
- idx_report_card_versions_changed_at

### Storage Bucket

#### report-cards

Stores generated PDF documents with the following structure:
- **Public**: false
- **File size limit**: 10MB
- **Allowed MIME types**: application/pdf
- **Path structure**: `{school_id}/{student_id}/{period_id}_{timestamp}.pdf`

---

## Workflow

### Report Card Lifecycle

```
┌──────────┐
│  Draft   │  Initial state, not yet generated
└────┬─────┘
     │
     ▼
┌─────────────┐
│  Generated  │  PDF created, calculations performed
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Published  │  Available to students/parents
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Archived   │  No longer actively used
└─────────────┘
```

### Generation Process

1. **Trigger**: Admin or accountant requests generation
2. **Validation**: Check student enrollment and grades exist
3. **Calculation**:
   - Fetch all published grades for the period
   - Calculate subject averages (weighted by coefficient)
   - Calculate overall average
   - Determine class ranking
   - Assign mention based on grading scale
4. **PDF Generation**: Create PDF using jsPDF
5. **Storage**: Upload PDF to Supabase Storage
6. **Database Record**: Create/update report_cards entry
7. **Versioning**: Automatic version creation if data changes

### Publication Process

1. **Prerequisites**:
   - Report card status = 'generated'
   - Payment status check (optional, depends on school policy)
2. **Action**: Admin publishes the report card
3. **Effect**:
   - status → 'published'
   - published_at = NOW()
   - published_by = current_user_id
4. **Result**: Students/parents can now view and download

---

## Features

### 1. Automatic Calculations

#### Overall Average Calculation

```sql
overall_average = SUM(subject_average * coefficient) / SUM(coefficient)
```

#### Class Ranking

Uses PostgreSQL's `RANK()` window function:
```sql
RANK() OVER (ORDER BY overall_average DESC)
```

#### Mention Determination

Based on grading scale configuration:
```json
{
  "mentions": [
    { "label": "Excellent", "min": 16, "max": 20, "color": "#10b981" },
    { "label": "Très Bien", "min": 14, "max": 16, "color": "#3b82f6" },
    { "label": "Bien", "min": 12, "max": 14, "color": "#6366f1" },
    { "label": "Assez Bien", "min": 10, "max": 12, "color": "#8b5cf6" },
    { "label": "Passable", "min": 8, "max": 10, "color": "#f59e0b" },
    { "label": "Insuffisant", "min": 0, "max": 8, "color": "#ef4444" }
  ]
}
```

### 2. PDF Generation

**Technology**: jsPDF (Deno-compatible version)

**Features**:
- Customizable templates
- School branding (logo, colors)
- Multi-page support
- Embed subject averages table
- Include overall statistics
- Mention badge with color

**Storage**: Supabase Storage with RLS

### 3. Versioning

Automatic version creation triggered by changes to:
- overall_average
- rank_in_class
- subject_averages

Each version stores:
- Complete data snapshot
- Change reason (optional)
- User who made change
- PDF URL for that version
- Timestamp

### 4. Payment-Based Access Control

**Statuses**:
- `ok`: No payment issues
- `warning`: Payment overdue but access allowed
- `blocked`: Payment arrears, access denied

**Override Mechanism**:
- Admins can override blocks
- Requires justification (min 10 characters)
- Fully audited
- Stored in report_cards table

**Access Logic**:
```typescript
canAccess = paymentStatus !== 'blocked' || paymentStatusOverride
```

### 5. Export Functionality

**Formats**:
- **CSV**: Comma-separated values for spreadsheet import
- **Excel**: Native .xlsx with multiple sheets

**Data Exported**:
- Student information (matricule, name)
- Class and period
- Overall average
- Ranking
- Mention
- Subject averages

---

## API Reference

### SQL Functions

#### calculate_class_rankings(p_class_id UUID, p_period_id UUID)

Calculates rankings for all students in a class for a given period.

**Returns**:
```sql
TABLE (
  student_id UUID,
  overall_average DECIMAL(5,2),
  rank INTEGER,
  class_size INTEGER
)
```

**Usage**:
```sql
SELECT * FROM calculate_class_rankings('class-uuid', 'period-uuid');
```

#### get_mention_for_average(p_average DECIMAL, p_grading_scale_id UUID)

Determines the mention based on average and grading scale.

**Returns**:
```sql
TABLE (
  mention_label VARCHAR(50),
  mention_color VARCHAR(7)
)
```

**Usage**:
```sql
SELECT * FROM get_mention_for_average(15.5, 'scale-uuid');
```

#### generate_report_card_data(p_student_id UUID, p_period_id UUID)

Generates complete report card data for a student.

**Returns**:
```sql
TABLE (
  student_id UUID,
  class_id UUID,
  academic_year_id UUID,
  grading_scale_id UUID,
  overall_average DECIMAL(5,2),
  rank_in_class INTEGER,
  class_size INTEGER,
  mention VARCHAR(50),
  mention_color VARCHAR(7),
  subject_averages JSONB
)
```

**Usage**:
```sql
SELECT * FROM generate_report_card_data('student-uuid', 'period-uuid');
```

### Edge Functions

#### POST /functions/v1/generate-report-card-pdf

Generates a report card PDF and creates database record.

**Request**:
```json
{
  "studentId": "uuid",
  "periodId": "uuid",
  "regenerate": false
}
```

**Response**:
```json
{
  "success": true,
  "reportCard": {
    "id": "uuid",
    "overallAverage": 15.5,
    "rankInClass": 3,
    "classSize": 28,
    "mention": "Très Bien",
    "pdfUrl": "https://..."
  },
  "message": "Report card generated successfully"
}
```

**Authorization**: Bearer token (school_admin or accountant)

### React Query Hooks

#### useReportCards(schoolId, filters?)

Fetches report cards with optional filters.

```typescript
const { data: reportCards, isLoading } = useReportCards(schoolId, {
  periodId: 'uuid',
  classId: 'uuid',
  status: 'published'
});
```

#### useGenerateReportCard()

Generates a single report card.

```typescript
const generateReportCard = useGenerateReportCard();

await generateReportCard.mutateAsync({
  studentId: 'uuid',
  periodId: 'uuid'
});
```

#### usePublishReportCard()

Publishes a report card.

```typescript
const publishReportCard = usePublishReportCard();

await publishReportCard.mutateAsync({
  id: 'report-card-uuid'
});
```

---

## Security and RLS

### Multi-Tenant Isolation

All tables include `school_id` for strict multi-tenancy.

### RLS Policies

#### Super Admin
- Full access to all report cards
- Full access to all versions
- Full access to storage

#### School Admin
- Full access to own school's report cards
- Read access to versions
- Manage own school's storage

#### Accountant
- Generate and manage report cards
- Cannot delete (preserve audit trail)
- Manage own school's storage

#### Teacher
- Read published report cards for their assigned classes
- No write access

#### Student
- Read own published report cards
- Access only if payment_status != 'blocked' OR override = true
- Read own PDFs from storage

#### Parent
- Read children's published report cards
- Access only if payment_status != 'blocked' OR override = true
- Read children's PDFs from storage

### Audit Trail

All changes to report_cards and report_card_versions are logged in audit_log table:
- INSERT (generation)
- UPDATE (modification, publication, override)
- DELETE (archiving)

---

## Usage Examples

### Example 1: Generate and Publish a Report Card

```typescript
import { useGenerateReportCard, usePublishReportCard } from '@novaconnect/data';

function ReportCardGenerator() {
  const generate = useGenerateReportCard();
  const publish = usePublishReportCard();

  const handleGenerateAndPublish = async () => {
    // Generate
    const reportCard = await generate.mutateAsync({
      studentId: 'student-uuid',
      periodId: 'period-uuid'
    });

    // Publish
    await publish.mutateAsync({
      id: reportCard.id
    });
  };
}
```

### Example 2: Export Class Statistics

```typescript
import { useExportReportCards } from '@novaconnect/data';

function ClassExport() {
  const exportCards = useExportReportCards();

  const handleExport = async () => {
    const blob = await exportCards.mutateAsync({
      periodId: 'period-uuid',
      classId: 'class-uuid',
      format: 'excel'
    });

    // Download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_cards_${Date.now()}.xlsx`;
    a.click();
  };
}
```

### Example 3: Override Payment Block

```typescript
import { useOverridePaymentBlock } from '@novaconnect/data';

function PaymentOverride() {
  const override = useOverridePaymentBlock();

  const handleOverride = async () => {
    await override.mutateAsync({
      id: 'report-card-uuid',
      reason: 'Parent confirmed payment made, awaiting bank clearance'
    });
  };
}
```

---

## Integration Points

### Existing Systems

#### Grades System
- **Dependency**: report_cards depends on published grades
- **Integration**: Uses grades table for calculations
- **Workflow**: Grades must be validated and published before report card generation

#### Grading Scales
- **Dependency**: report_cards uses grading_scale configuration
- **Integration**: Reads scale_config.mentions for determination
- **Flexibility**: Supports multiple grading scales per school

#### Periods System
- **Dependency**: report_cards linked to periods
- **Integration**: Filters by period_id
- **Workflow**: One report card per student per period per academic year

#### Enrollment System
- **Dependency**: report_cards requires active enrollment
- **Integration**: Validates student is enrolled in class
- **Error Handling**: Fails if student not enrolled

### Future Systems

#### Payment System (Planned)
- **Integration**: Will update payment_status field
- **Trigger**: Automatic based on payment arrears
- **Override**: Admin manual override available

#### Notification System (Planned)
- **Integration**: Notify students/parents when report cards published
- **Channels**: In-app, email, SMS
- **Templates**: Customizable per school

---

## Future Enhancements

### Phase 2: Payment Integration

1. **Payment Tables**
   - fees
   - payments
   - payment_plans
   - payment_reminders

2. **Automated Status Updates**
   - Trigger on payment recording
   - Update payment_status automatically
   - Send notifications

3. **Payment Plans**
   - Installment tracking
   - Partial payment handling
   - Payment plan agreements

### Phase 3: Advanced Features

1. **Multi-Language Support**
   - Translated PDF templates
   - Localized mentions
   - Bilingual reports

2. **Custom Templates**
   - School-specific templates
   - Template editor
   - Preview functionality

3. **Comparative Analytics**
   - Year-over-year comparison
   - Class performance trends
   - Subject performance analysis

4. **Digital Signatures**
   - Admin signature on PDFs
   - Certificate of authenticity
   - Anti-fraud measures

### Phase 4: Student Portal Enhancements

1. **Interactive Charts**
   - Performance over time
   - Subject breakdown
   - Class comparison (anonymized)

2. **Goal Setting**
   - Target averages
   - Improvement tracking
   - Achievement badges

3. **Parent Communication**
   - Comments section
   - Teacher feedback
   - Conference scheduling

---

## Troubleshooting

### Common Issues

#### Issue: Report card generation fails

**Possible causes**:
1. Student not enrolled in any class
2. No published grades for the period
3. Grading scale not configured

**Solution**: Check enrollment, grades status, and grading scale configuration

#### Issue: Ranking calculation incorrect

**Possible causes**:
1. Grades not yet published
2. Some students missing grades
3. Coefficient misconfiguration

**Solution**: Ensure all grades are published and coefficients are correct

#### Issue: PDF generation timeout

**Possible causes**:
1. Large number of subjects
2. Network latency
3. Storage bucket issues

**Solution**:
- Optimize PDF template
- Increase Edge Function timeout
- Check Supabase Storage status

#### Issue: Access denied for students

**Possible causes**:
1. Report card not published
2. Payment status blocked
3. RLS policy misconfiguration

**Solution**:
- Publish report card
- Check payment_status or set override
- Verify RLS policies

---

## Performance Considerations

### Database Optimization

1. **Indexes**: All foreign keys and frequently queried columns indexed
2. **JSONB**: Efficient storage and querying of subject_averages
3. **Window Functions**: Efficient ranking calculations

### Caching Strategy

1. **React Query**: Automatic caching with configurable TTL
2. **Storage URLs**: Public URLs cached on client side
3. **Static Data**: Periods, classes cached on mount

### Batch Operations

1. **Batch Generation**: Parallel processing with Promise.allSettled
2. **Bulk Export**: Single query for all report cards
3. **Version Cleanup**: Scheduled job to archive old versions

---

## Conclusion

The Report Cards System provides a robust, secure, and scalable solution for managing student report cards within NovaConnect. It integrates seamlessly with existing systems while providing flexibility for future enhancements.

### Key Strengths

- ✅ Automated calculations with configurable rules
- ✅ Comprehensive versioning and audit trail
- ✅ Secure multi-tenant architecture
- ✅ Payment integration ready
- ✅ Multiple export formats
- ✅ Mobile and web interfaces
- ✅ Role-based access control

### Next Steps

1. Deploy migrations to production
2. Test PDF generation with real data
3. Configure grading scales for each school
4. Train administrators on interface
5. Gather user feedback for improvements

---

**Document Version**: 1.0.0
**Last Updated**: 2025-01-26
**Author**: NovaConnect Development Team
