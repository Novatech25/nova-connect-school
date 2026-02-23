import { getSupabaseClient } from '../client';

export async function uploadAttachment(
  messageId: string,
  file: File
): Promise<{ id: string; url: string }> {
  const user = (await getSupabaseClient().auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  // Valider fichier via Edge Function
  const { data: validation, error: validationError } = await getSupabaseClient().functions.invoke(
    'validate-chat-attachment',
    {
      body: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
    }
  );

  if (validationError) throw validationError;
  if (!validation.valid) throw new Error(validation.error);

  // Upload vers Storage
  const fileExt = file.name.split('.').pop();
  const fileName = `${user.id}/${messageId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { data: uploadData, error: uploadError } = await getSupabaseClient().storage
    .from('chat-attachments')
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  // Créer enregistrement attachment
  const { data: attachment, error: attachmentError } = await getSupabaseClient()
    .from('chat_attachments')
    .insert({
      message_id: messageId,
      file_name: file.name,
      file_type: validation.fileType,
      file_size: file.size,
      file_path: uploadData.path,
      mime_type: file.type,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (attachmentError) throw attachmentError;

  // Générer URL signée (valide 1 heure)
  const { data: urlData } = await getSupabaseClient().storage
    .from('chat-attachments')
    .createSignedUrl(uploadData.path, 3600);

  return {
    id: attachment.id,
    url: urlData?.signedUrl || '',
  };
}

export async function getAttachmentUrl(filePath: string): Promise<string> {
  const { data } = await getSupabaseClient().storage
    .from('chat-attachments')
    .createSignedUrl(filePath, 3600);

  return data?.signedUrl || '';
}
