import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  document: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  pdf: ['application/pdf'],
  video: ['video/mp4', 'video/webm'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
};

const MAX_FILE_SIZES = {
  image: 5 * 1024 * 1024, // 5MB
  document: 10 * 1024 * 1024, // 10MB
  pdf: 10 * 1024 * 1024, // 10MB
  video: 50 * 1024 * 1024, // 50MB
  audio: 20 * 1024 * 1024, // 20MB
};

serve(async (req) => {
  try {
    const { fileName, fileSize, mimeType } = await req.json();

    // Déterminer type de fichier
    let fileType: string | null = null;
    for (const [type, mimes] of Object.entries(ALLOWED_MIME_TYPES)) {
      if (mimes.includes(mimeType)) {
        fileType = type;
        break;
      }
    }

    if (!fileType) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `File type not allowed: ${mimeType}`
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier taille
    const maxSize = MAX_FILE_SIZES[fileType as keyof typeof MAX_FILE_SIZES];
    if (fileSize > maxSize) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `File too large: ${fileSize} bytes (max: ${maxSize} bytes)`
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier extension
    const ext = fileName.split('.').pop()?.toLowerCase();
    const dangerousExtensions = ['exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js'];
    if (ext && dangerousExtensions.includes(ext)) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `Dangerous file extension: ${ext}`
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        fileType,
        maxSize
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error validating attachment:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
