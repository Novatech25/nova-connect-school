import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Loader2, Plus, Pencil, MapPin, Home, DoorOpen } from 'lucide-react'
import { supabase } from '@novaconnect/data'

interface Campus {
  id: string
  name: string
  code: string
}

interface Room {
  id: string
  name: string
  code: string
  capacity: number | null
  room_type: string
  size_category: 'very_large' | 'large' | 'medium' | 'small' | null
  campus_id: string
  is_available: boolean
  campus?: Campus
}

const SIZE_CATEGORIES = {
  very_large: { label: 'Très Grande', color: 'bg-purple-500' },
  large: { label: 'Grande', color: 'bg-blue-500' },
  medium: { label: 'Moyenne', color: 'bg-green-500' },
  small: { label: 'Petite', color: 'bg-yellow-500' },
} as const

const ROOM_TYPES = {
  classroom: 'Salle de classe',
  lab: 'Laboratoire',
  amphitheater: 'Amphithéâtre',
  library: 'Bibliothèque',
  gym: 'Gymnase',
  other: 'Autre',
}

export default function RoomsManagementPage() {
  const params = useParams()
  const schoolId = params?.schoolId as string

  const [rooms, setRooms] = useState<Room[]>([])
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    capacity: '',
    room_type: 'classroom',
    size_category: '',
    campus_id: '',
    is_available: true,
  })

  useEffect(() => {
    fetchRooms()
    fetchCampuses()
  }, [schoolId])

  const fetchRooms = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('rooms')
      .select('*, campus:campuses(id, name, code)')
      .eq('campus_id', campuses.map(c => c.id))
      .order('name')

    if (!error && data) {
      setRooms(data)
    }
    setIsLoading(false)
  }

  const fetchCampuses = async () => {
    const { data } = await supabase
      .from('campuses')
      .select('*')
      .eq('school_id', schoolId)
      .order('name')

    if (data) {
      setCampuses(data)
    }
  }

  const handleEdit = (room: Room) => {
    setEditingRoom(room)
    setFormData({
      name: room.name,
      code: room.code,
      capacity: room.capacity?.toString() || '',
      room_type: room.room_type,
      size_category: room.size_category || '',
      campus_id: room.campus_id,
      is_available: room.is_available,
    })
    setIsDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingRoom(null)
    setFormData({
      name: '',
      code: '',
      capacity: '',
      room_type: 'classroom',
      size_category: '',
      campus_id: campuses[0]?.id || '',
      is_available: true,
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      if (editingRoom) {
        // Update
        const { error } = await supabase
          .from('rooms')
          .update({
            name: formData.name,
            code: formData.code,
            capacity: formData.capacity ? parseInt(formData.capacity) : null,
            room_type: formData.room_type,
            size_category: formData.size_category || null,
            campus_id: formData.campus_id,
            is_available: formData.is_available,
          })
          .eq('id', editingRoom.id)

        if (error) throw error
      } else {
        // Create
        const { error } = await supabase
          .from('rooms')
          .insert({
            school_id: schoolId,
            name: formData.name,
            code: formData.code,
            capacity: formData.capacity ? parseInt(formData.capacity) : null,
            room_type: formData.room_type,
            size_category: formData.size_category || null,
            campus_id: formData.campus_id,
            is_available: formData.is_available,
          })

        if (error) throw error
      }

      await fetchRooms()
      setIsDialogOpen(false)
    } catch (error: any) {
      console.error('Error saving room:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const getSizeBadge = (sizeCategory: string | null) => {
    if (!sizeCategory) return null
    const config = SIZE_CATEGORIES[sizeCategory as keyof typeof SIZE_CATEGORIES]
    if (!config) return null

    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DoorOpen className="h-8 w-8" />
            Gestion des Salles
          </h1>
          <p className="text-muted-foreground mt-2">
            Gérez les salles et définissez leurs catégories pour l'affectation automatique
          </p>
        </div>

        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle Salle
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Salles de l'école</CardTitle>
          <CardDescription>
            Définissez la capacité et la catégorie de taille pour chaque salle afin d'optimiser l'affectation automatique
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Campus</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Capacité</TableHead>
                <TableHead>Catégorie Taille</TableHead>
                <TableHead>Disponible</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    <Home className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucune salle configurée</p>
                    <p className="text-sm mt-2">Cliquez sur "Nouvelle Salle" pour commencer</p>
                  </TableCell>
                </TableRow>
              ) : (
                rooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">{room.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{room.code}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {room.campus?.name}
                      </div>
                    </TableCell>
                    <TableCell>{ROOM_TYPES[room.room_type as keyof typeof ROOM_TYPES]}</TableCell>
                    <TableCell>
                      {room.capacity ? (
                        <span className="flex items-center gap-1">
                          <span>{room.capacity}</span>
                          <span className="text-xs text-muted-foreground">élèves</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getSizeBadge(room.size_category)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={room.is_available ? 'default' : 'secondary'}>
                        {room.is_available ? 'Oui' : 'Non'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(room)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRoom ? 'Modifier la salle' : 'Nouvelle salle'}
            </DialogTitle>
            <DialogDescription>
              {editingRoom
                ? 'Modifiez les informations de la salle'
                : 'Ajoutez une nouvelle salle à votre école'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de la salle *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Salle 201, Amphithéâtre A"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Ex: 201, AMPH-A"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="campus">Campus *</Label>
              <Select
                value={formData.campus_id}
                onValueChange={(value) => setFormData({ ...formData, campus_id: value })}
              >
                <SelectTrigger id="campus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {campuses.map((campus) => (
                    <SelectItem key={campus.id} value={campus.id}>
                      {campus.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="room_type">Type de salle *</Label>
              <Select
                value={formData.room_type}
                onValueChange={(value) => setFormData({ ...formData, room_type: value })}
              >
                <SelectTrigger id="room_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROOM_TYPES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Capacité (nombre d'élèves)</Label>
              <Input
                id="capacity"
                type="number"
                min={1}
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                placeholder="Ex: 30"
              />
              <p className="text-xs text-muted-foreground">
                Laissez vide si la capacité n'est pas limitée
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="size_category">Catégorie de taille</Label>
              <Select
                value={formData.size_category}
                onValueChange={(value) => setFormData({ ...formData, size_category: value })}
              >
                <SelectTrigger id="size_category">
                  <SelectValue placeholder="Sélectionnez une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="very_large">Très Grande (100+ élèves)</SelectItem>
                  <SelectItem value="large">Grande (60-100 élèves)</SelectItem>
                  <SelectItem value="medium">Moyenne (30-60 élèves)</SelectItem>
                  <SelectItem value="small">Petite (-30 élèves)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Utilisé pour prioriser les salles lors de l'affectation automatique
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="available">Salle disponible</Label>
                <p className="text-sm text-muted-foreground">
                  Désactivez temporairement si la salle est en maintenance
                </p>
              </div>
              <Switch
                id="available"
                checked={formData.is_available}
                onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSaving}
              >
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingRoom ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
