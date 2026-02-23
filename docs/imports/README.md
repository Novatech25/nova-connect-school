# Import Excel/CSV Module

The Import Excel/CSV module allows school administrators to bulk import students, grades, and schedules from Excel or CSV files. This premium feature includes validation, preview, and rollback capabilities.

## Features

- **Multi-Format Support**: Import from Excel (.xlsx, .xls) or CSV files
- **Smart Column Mapping**: Automatic column detection with manual override
- **Data Validation**: Comprehensive validation before import
- **Preview Mode**: Review data before committing to import
- **Rollback Support**: Undo imports if needed
- **Template Management**: Save and reuse column mappings
- **Audit Trail**: Complete history of all import operations

## Requirements

- **License**: Premium or Enterprise license
- **Enabled Module**: `api_import` must be enabled in school settings
- **Roles**: School Admin or Supervisor
- **File Size**: Maximum 50MB per file
- **Rows**: Maximum 10,000 rows per import

## Accessing the Import Module

1. Navigate to **Admin** → **Imports** in the sidebar
2. Or use direct links:
   - **Students**: Admin → Imports → Students
   - **Grades**: Admin → Imports → Grades
   - **Schedules**: Admin → Imports → Schedules

## Import Workflow

### Step 1: Select Import Type

Choose what you want to import:
- **Students**: Student records with enrollment information
- **Grades**: Student grades and scores
- **Schedules**: Class schedules and timetables

### Step 2: Upload File

1. Click **Upload File** or drag and drop your file
2. Supported formats:
   - Excel: `.xlsx`, `.xls`
   - CSV: `.csv` (auto-detects delimiter)
3. Maximum file size: 50MB
4. Maximum rows: 10,000

### Step 3: Map Columns

Map your file columns to database fields:

**For Students Import:**
- `First Name` → `firstName` (required)
- `Last Name` → `lastName` (required)
- `Matricule` → `matricule` (optional)
- `Email` → `email` (optional)
- `Phone` → `phone` (optional)
- `Date of Birth` → `dateOfBirth` (optional)
- `Class` → `classId` (optional)
- `Parent Name` → `parentName` (optional)
- `Parent Phone` → `parentPhone` (optional)

**For Grades Import:**
- `Student Matricule` → `studentMatricule` (required)
- `Subject Code` → `subjectCode` (required)
- `Score` → `score` (required)
- `Max Score` → `maxScore` (optional)
- `Trimester` → `trimester` (optional)
- `School Year` → `schoolYear` (optional)
- `Exam Date` → `examDate` (optional)

**For Schedules Import:**
- `Class` → `classId` (required)
- `Subject` → `subjectId` (required)
- `Teacher` → `teacherId` (required)
- `Day of Week` → `dayOfWeek` (required)
- `Start Time` → `startTime` (required)
- `End Time` → `endTime` (required)
- `Room` → `room` (optional)

**Tips:**
- Use the dropdown to map each column
- Preview shows first 5 values from your file
- Required fields are marked with an asterisk (*)
- Click **Auto-Detect** to let the system guess mappings

### Step 4: Preview and Validate

Review the validation results:

**Valid Rows**: Green checkmark - ready to import
**Invalid Rows**: Red X - has errors that must be fixed

Common validation errors:
- **Missing required fields**: Fill in all required columns
- **Invalid email format**: Check email addresses
- **Invalid date format**: Use YYYY-MM-DD or DD/MM/YYYY
- **Duplicate matricule**: Each student must have a unique matricule
- **Class not found**: Verify class names exist in the system
- **Student not found**: Check student matricules for grades import
- **Teacher not found**: Verify teacher names for schedules

**Actions:**
- Review error details for each invalid row
- Fix your source file and re-upload if needed
- Proceed only if you have valid rows

### Step 5: Import Progress

Monitor the import in real-time:
- Progress bar shows completion percentage
- Status updates every 2 seconds
- Final summary shows:
  - Rows imported successfully
  - Rows skipped (invalid)
  - Any errors that occurred

**After Import:**
- Download detailed report (optional)
- View import history
- Rollback if needed (within 7 days)

## Rollback Function

Undo an import if you made a mistake:

1. Go to **Imports** page
2. Find the import job
3. Click **Rollback** (if available)
4. Confirm the rollback

**Rollback Rules:**
- Only imports from the last 7 days can be rolled back
- Rollback reverses all changes made during import
- Cannot rollback if:
  - More than 7 days have passed
  - Data has been significantly modified
  - Another import depends on this data

## Template Management

Save time by creating reusable templates:

### Creating a Template

1. Complete the column mapping step
2. Click **Save as Template**
3. Enter template name and description
4. Template is saved for future use

### Using a Template

1. On the column mapping step, click **Load Template**
2. Select your saved template
3. Mappings are automatically applied

### Managing Templates

Navigate to **Imports** → **Templates** to:
- View all templates
- Edit existing templates
- Delete unused templates
- Export templates as JSON

## File Format Guidelines

### Excel Files

- Use `.xlsx` format (preferred) or `.xls`
- First row should contain column headers
- Avoid merged cells
- Use consistent formatting

### CSV Files

- Use UTF-8 encoding
- Comma-separated (auto-detects other delimiters)
- First row should contain column headers
- Quote values containing commas: `"Doe, John"`

### Date Formats

Supported formats:
- `YYYY-MM-DD` (ISO 8601) - preferred
- `DD/MM/YYYY`
- `MM/DD/YYYY`
- Excel date serial numbers

### Best Practices

1. **Clean Data First**
   - Remove duplicates
   - Fix typos and formatting
   - Validate against existing data

2. **Use Consistent Formatting**
   - Standardize date formats
   - Use proper capitalization
   - Validate email addresses

3. **Test with Small Files**
   - Import 5-10 rows first
   - Verify results
   - Then do full import

4. **Keep Backup**
   - Always keep original file
   - Save import reports
   - Document mapping decisions

## Troubleshooting

### Import Fails

**Error: "File too large"**
- File exceeds 50MB limit
- Split into smaller files
- Remove unnecessary columns

**Error: "Too many rows"**
- File exceeds 10,000 row limit
- Split into multiple imports
- Remove old/duplicate data

**Error: "Invalid file format"**
- Check file extension
- Ensure file is not corrupted
- Try resaving as CSV

### Validation Errors

**"Missing required field"**
- Check all required columns have data
- Look for empty cells
- Verify column mapping

**"Student not found"**
- Matricule doesn't exist in database
- Import students first before grades
- Check for typos in matricules

**"Class not found"**
- Class name doesn't match database
- Create class first or use exact name
- Check for extra spaces

**"Duplicate entry"**
- Same record appears multiple times
- Remove duplicates from file
- Check if already imported

### Performance Issues

**Import is slow**
- Large files take time (up to 10,000 rows)
- Be patient, don't refresh page
- Progress updates every 2 seconds

**Preview takes too long**
- Complex validation on many rows
- Wait for validation to complete
- Cannot skip this step

## Security and Permissions

### Access Control

**Who can import:**
- School Admins (full access)
- Supervisors (full access)

**What can be imported:**
- Students: School's own students
- Grades: School's own grades
- Schedules: School's own schedules

### Audit Trail

All import operations are logged:
- Who initiated the import
- What type of import
- When it was performed
- How many rows processed
- Any errors that occurred

View audit logs in **Settings** → **Audit Logs**

## Rate Limits and Quotas

Default limits per school:
- **Monthly imports**: 100
- **Max file size**: 50MB
- **Max rows per import**: 10,000

Enterprise licenses may have higher limits. Contact support to increase quotas.

## API Access

Developers can also use the import API:

```typescript
import { useUploadImportFile, useParseImportFile, useExecuteImport } from '@novaconnect/data';

// 1. Create import job and upload file
const uploadMutation = useUploadImportFile();
await uploadMutation.mutateAsync({
  schoolId: 'uuid',
  importJobId: 'uuid',
  file: fileObject
});

// 2. Parse and validate file
const parseMutation = useParseImportFile();
await parseMutation.mutateAsync(importJobId);

// 3. Execute import
const executeMutation = useExecuteImport();
await executeMutation.mutateAsync(importJobId);
```

See API documentation for more details.

## Support

For issues or questions:
1. Check this documentation
2. Review error messages carefully
3. Check import history for details
4. Contact support with:
   - Import job ID
   - Error message
   - Sample data (sanitized)

## Changelog

### Version 1.0.0 (2025-02-20)
- Initial release
- Support for students, grades, schedules imports
- Column mapping and validation
- Rollback functionality
- Template management
