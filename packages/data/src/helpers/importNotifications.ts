import { getSupabaseClient } from "../client";

const supabase = getSupabaseClient();

/**
 * Create a notification for import job status changes
 */
export async function createImportNotification(
  userId: string,
  schoolId: string,
  importJobId: string,
  status: string,
  importType: string,
  details?: {
    totalRows?: number;
    importedRows?: number;
    invalidRows?: number;
    errorMessage?: string;
  }
): Promise<void> {
  let title = "";
  let message = "";
  let type = "info";

  switch (status) {
    case "parsing":
      title = "Import Started";
      message = `Your ${importType} import is being processed...`;
      type = "info";
      break;

    case "completed":
      title = "Import Completed Successfully";
      message = `Successfully imported ${details?.importedRows} ${importType} records.`;
      type = "success";
      break;

    case "failed":
      title = "Import Failed";
      message = details?.errorMessage || "An error occurred during import. Please check the import history for details.";
      type = "error";
      break;

    case "rolled_back":
      title = "Import Rolled Back";
      message = `The ${importType} import has been rolled back.`;
      type = "warning";
      break;

    default:
      return;
  }

  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    school_id: schoolId,
    type: type,
    title: title,
    message: message,
    action_url: `/admin/imports?job=${importJobId}`,
    metadata: {
      import_job_id: importJobId,
      import_type: importType,
      status: status,
      details: details,
    },
  });

  if (error) {
    console.error("Failed to create import notification:", error);
  }
}

/**
 * Create notifications for all school admins when an import completes
 */
export async function notifySchoolAdminsAboutImport(
  schoolId: string,
  importJobId: string,
  status: string,
  importType: string,
  details?: {
    totalRows?: number;
    importedRows?: number;
    invalidRows?: number;
    errorMessage?: string;
  }
): Promise<void> {
  // Get all school admins and supervisors
  const { data: userRoles, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("school_id", schoolId)
    .in("role_id", (await supabase.from("roles").select("id").in("name", ["school_admin", "supervisor"])).data?.map((r) => r.id) || []);

  if (rolesError || !userRoles) {
    console.error("Failed to fetch school admins:", rolesError);
    return;
  }

  // Create notification for each admin
  for (const userRole of userRoles) {
    await createImportNotification(
      userRole.user_id,
      schoolId,
      importJobId,
      status,
      importType,
      details
    );
  }
}

/**
 * Check if user has opted in to import notifications
 */
export async function shouldSendImportNotification(userId: string, notificationType: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("enabled")
    .eq("user_id", userId)
    .eq("notification_type", notificationType)
    .maybeSingle();

  if (error) {
    console.error("Failed to check notification preferences:", error);
    return true; // Default to sending if error
  }

  // If no preference set, default to enabled
  return data?.enabled !== false;
}

/**
 * Send import notification if user has opted in
 */
export async function sendImportNotificationIfEnabled(
  userId: string,
  schoolId: string,
  importJobId: string,
  status: string,
  importType: string,
  details?: {
    totalRows?: number;
    importedRows?: number;
    invalidRows?: number;
    errorMessage?: string;
  }
): Promise<void> {
  const notificationType = `import_${status}`;

  const shouldSend = await shouldSendImportNotification(userId, notificationType);

  if (shouldSend) {
    await createImportNotification(userId, schoolId, importJobId, status, importType, details);
  }
}
