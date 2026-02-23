'use client'

import { useCallback, useEffect, useState } from 'react'
import { useStudents } from './useStudents'
import { useStudentPhoto } from './useStudentPhoto'

interface StudentWithPhoto {
  id: string
  firstName: string
  lastName: string
  matricule?: string
  photoUrl?: string
  enrollments?: any[]
  [key: string]: any
}

/**
 * Hook qui récupère les élèves avec leurs photos
 * Combine useStudents et useStudentPhoto
 */
export function useStudentsWithPhotos(
  schoolId: string,
  filters?: {
    status?: string
    classId?: string
  }
) {
  const { data: students, isLoading, error } = useStudents(schoolId, filters)
  const { getPhotoUrl } = useStudentPhoto()
  const [studentsWithPhotos, setStudentsWithPhotos] = useState<StudentWithPhoto[]>([])
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false)

  const fetchPhotos = useCallback(async () => {
    if (!students || students.length === 0) {
      setStudentsWithPhotos([])
      return
    }

    setIsLoadingPhotos(true)
    
    try {
      // Récupérer toutes les photos en parallèle
      const photoPromises = students.map(async (student: any) => {
        const photoUrl = await getPhotoUrl(student.id)
        return {
          ...student,
          photoUrl: photoUrl || undefined,
        }
      })

      const results = await Promise.all(photoPromises)
      setStudentsWithPhotos(results)
    } catch (err) {
      console.error('Error fetching photos:', err)
      // En cas d'erreur, retourner les élèves sans photos
      setStudentsWithPhotos(students.map((s: any) => ({ ...s, photoUrl: undefined })))
    } finally {
      setIsLoadingPhotos(false)
    }
  }, [students, getPhotoUrl])

  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  return {
    data: studentsWithPhotos,
    isLoading: isLoading || isLoadingPhotos,
    error,
    refetchPhotos: fetchPhotos,
  }
}

export default useStudentsWithPhotos
