'use client'

import { useCallback, useState } from 'react'
import { getSupabaseClient } from '../client'

interface StudentPhoto {
  id: string
  file_url: string
  file_name: string
  uploaded_at: string
}

interface UseStudentPhotoReturn {
  uploadPhoto: (studentId: string, file: File) => Promise<StudentPhoto | null>
  getPhotoUrl: (studentId: string) => Promise<string | null>
  isUploading: boolean
  error: Error | null
}

/**
 * Hook pour gérer les photos des élèves
 * 
 * @example
 * ```tsx
 * const { uploadPhoto, getPhotoUrl, isUploading } = useStudentPhoto()
 * 
 * // Uploader une photo
 * const photo = await uploadPhoto(studentId, file)
 * 
 * // Récupérer l'URL de la photo
 * const url = await getPhotoUrl(studentId)
 * ```
 */
export function useStudentPhoto(): UseStudentPhotoReturn {
  const supabase = getSupabaseClient()
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Récupère l'URL de la photo d'un élève
   */
  const getPhotoUrl = useCallback(async (studentId: string): Promise<string | null> => {
    try {
      // Récupérer le document photo le plus récent
      const { data: photoDoc, error: fetchError } = await supabase
        .from('student_documents')
        .select('file_url')
        .eq('student_id', studentId)
        .eq('document_type', 'photo')
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .single()

      if (fetchError || !photoDoc) {
        return null
      }

      // Générer l'URL publique
      const { data: { publicUrl } } = supabase
        .storage
        .from('documents')
        .getPublicUrl(photoDoc.file_url)

      return publicUrl
    } catch (err) {
      console.error('Error fetching photo URL:', err)
      return null
    }
  }, [])

  /**
   * Upload une nouvelle photo pour un élève
   */
  const uploadPhoto = useCallback(async (
    studentId: string, 
    file: File
  ): Promise<StudentPhoto | null> => {
    console.log('useStudentPhoto: Début upload pour', studentId)
    setIsUploading(true)
    setError(null)

    try {
      // Récupérer l'user courant et le school_id
      console.log('Récupération user...')
      const { data: { user } } = await supabase.auth.getUser()
      console.log('User:', user?.id)
      
      if (!user) {
        console.error('User non authentifié')
        throw new Error('Utilisateur non authentifié')
      }

      // Récupérer le school_id de l'élève
      console.log('Récupération student:', studentId)
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('school_id')
        .eq('id', studentId)
        .single()

      if (studentError || !student) {
        console.error('Student error:', studentError)
        throw new Error('Élève non trouvé')
      }
      console.log('School ID:', student.school_id)

      const schoolId = student.school_id
      const timestamp = Date.now()
      const fileExtension = file.name.split('.').pop()
      const fileName = `${timestamp}_${Math.random().toString(36).substring(7)}.${fileExtension}`
      
      // Chemin dans le bucket: school_id/uploader_id/photo/filename
      const filePath = `${schoolId}/${user.id}/photo/${fileName}`

      // Upload vers Supabase Storage
      console.log('Upload vers Storage:', filePath)
      const { error: uploadError } = await supabase
        .storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw new Error(`Erreur upload: ${uploadError.message}`)
      }
      console.log('Upload storage OK')

      // Créer l'entrée dans student_documents
      console.log('Création document DB...')
      const { data: document, error: docError } = await supabase
        .from('student_documents')
        .insert({
          school_id: schoolId,
          student_id: studentId,
          document_type: 'photo',
          title: 'Photo d\'identité',
          file_url: filePath,
          file_name: file.name,
          file_size: file.size.toString(),
          mime_type: file.type,
          uploaded_by: user.id,
          uploaded_at: new Date().toISOString(),
          metadata: {
            uploadedVia: 'admin_portal',
            originalFileName: file.name,
          },
        })
        .select()
        .single()

      if (docError) {
        console.error('Document error:', docError)
        // Rollback: supprimer le fichier uploadé
        await supabase.storage.from('documents').remove([filePath])
        throw new Error(`Erreur base de données: ${docError.message}`)
      }
      console.log('Document créé:', document?.id)

      // Générer l'URL publique
      const { data: { publicUrl } } = supabase
        .storage
        .from('documents')
        .getPublicUrl(filePath)

      return {
        id: document.id,
        file_url: publicUrl,
        file_name: file.name,
        uploaded_at: document.uploaded_at,
      }
    } catch (err) {
      console.error('Catch error:', err)
      const error = err instanceof Error ? err : new Error('Erreur lors de l\'upload')
      setError(error)
      throw error
    } finally {
      console.log('Upload terminé')
      setIsUploading(false)
    }
  }, [])

  return {
    uploadPhoto,
    getPhotoUrl,
    isUploading,
    error,
  }
}

export default useStudentPhoto
