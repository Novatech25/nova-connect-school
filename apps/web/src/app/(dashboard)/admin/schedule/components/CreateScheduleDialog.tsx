import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAcademicYears, useAuthContext, useCreateSchedule } from '@novaconnect/data'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const formSchema = z.object({
  name: z.string().min(3, {
    message: 'Le nom doit contenir au moins 3 caractères.',
  }),
  description: z.string().optional(),
  academicYearId: z
    .string({
      required_error: 'Veuillez sélectionner une année scolaire.',
    })
    .min(1, 'Veuillez sélectionner une année scolaire.'),
})

interface CreateScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateScheduleDialog({ open, onOpenChange, onSuccess }: CreateScheduleDialogProps) {
  const { toast } = useToast()
  const { profile, user } = useAuthContext()
  const schoolId =
    profile?.school?.id || profile?.school_id || user?.schoolId || (user as any)?.school_id

  const { data: academicYears = [] } = useAcademicYears(schoolId || '')
  const createScheduleMutation = useCreateSchedule()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      academicYearId: '',
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log('CLICKED - Form Submitted', values) // DEBUG
    if (!schoolId) {
      console.error('CLICKED - No schoolId') // DEBUG
      toast({
        title: 'Erreur',
        description: 'École non identifiée.',
        variant: 'destructive',
      })
      return
    }

    try {
      console.log('CLICKED - Calling mutation') // DEBUG
      await createScheduleMutation.mutateAsync({
        schoolId,
        name: values.name,
        description: values.description || '',
        academicYearId: values.academicYearId,
        // status is now hardcoded in RPC V4, no need to pass it
        version: 1,
      })
      console.log('CLICKED - Mutation success') // DEBUG

      toast({
        title: 'Succès',
        description: "L'emploi du temps a été créé.",
      })

      form.reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error('CLICKED - Mutation error full details:', JSON.stringify(error, null, 2)) // DEBUG
      toast({
        title: 'Erreur',
        description: error.message || 'Une erreur est survenue lors de la création.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Créer un emploi du temps</DialogTitle>
          <DialogDescription>
            Créez un nouvel emploi du temps pour l'année scolaire sélectionnée.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: EDT Trimestre 1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Description optionnelle..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="academicYearId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Année scolaire *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une année" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {academicYears.map((year: any) => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createScheduleMutation.isPending}>
                {createScheduleMutation.isPending ? 'Création...' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
