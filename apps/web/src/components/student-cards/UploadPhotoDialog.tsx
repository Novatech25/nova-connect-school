'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useStudentPhoto } from '@novaconnect/data'
import { Upload, X, Camera, Check } from 'lucide-react'

interface UploadPhotoDialogProps {
  studentId: string
  studentName: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function UploadPhotoDialog({
  studentId,
  studentName,
  isOpen,
  onClose,
  onSuccess,
}: UploadPhotoDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploadPhoto, isUploading } = useStudentPhoto()
  const { toast } = useToast()

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner une image (JPG, PNG)',
        variant: 'destructive',
      })
      return
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Erreur',
        description: 'L\'image ne doit pas dépasser 5 Mo',
        variant: 'destructive',
      })
      return
    }

    setSelectedFile(file)
    
    // Créer un aperçu
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      console.log('Pas de fichier sélectionné')
      return
    }

    if (!studentId) {
      console.error('Pas de studentId!')
      toast({
        title: 'Erreur',
        description: 'ID élève manquant',
        variant: 'destructive',
      })
      return
    }

    console.log('Début upload pour studentId:', studentId)
    console.log('Fichier:', selectedFile.name, selectedFile.size, 'bytes')

    try {
      const result = await uploadPhoto(studentId, selectedFile)
      console.log('Upload réussi:', result)
      
      toast({
        title: 'Succès',
        description: 'Photo téléchargée avec succès',
      })
      
      // Réinitialiser
      setSelectedFile(null)
      setPreviewUrl(null)
      
      // Fermer et notifier
      onClose()
      onSuccess?.()
    } catch (error: any) {
      console.error('Erreur upload:', error)
      toast({
        title: 'Erreur',
        description: error.message || 'Échec du téléchargement',
        variant: 'destructive',
      })
    }
  }

  const handleClose = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    onClose()
  }

  const clearSelection = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Ajouter une photo
          </DialogTitle>
          <DialogDescription>
            Photo d&apos;identité pour {studentName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Zone d'aperçu ou upload */}
          <div className="relative">
            {previewUrl ? (
              <div className="relative aspect-square w-full max-w-[300px] mx-auto">
                <img
                  src={previewUrl}
                  alt="Aperçu"
                  className="w-full h-full object-cover rounded-lg border"
                />
                <button
                  onClick={clearSelection}
                  className="absolute -top-2 -right-2 p-1 bg-destructive text-white rounded-full hover:bg-destructive/90"
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
              >
                <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Cliquez pour sélectionner une photo
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPG, PNG - Max 5 Mo
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />
          </div>

          {/* Conseils */}
          <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
            <p className="font-medium mb-1">Conseils pour une bonne photo :</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Visage centré et bien éclairé</li>
              <li>Fond neutre (blanc ou clair)</li>
              <li>Pas de lunettes de soleil</li>
              <li>Expression neutre</li>
            </ul>
          </div>

          {/* Boutons d'action */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="gap-2"
            >
              {isUploading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Téléchargement...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Confirmer
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default UploadPhotoDialog
