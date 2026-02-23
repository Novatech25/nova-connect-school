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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { zodResolver } from '@hookform/resolvers/zod'
import { useUpdateSchedule } from '@novaconnect/data'
import { useForm } from 'react-hook-form'
import { useEffect } from 'react'
import { z } from 'zod'

const formSchema = z.object({
  name: z.string().min(3, {
    message: 'Le nom doit contenir au moins 3 caractères.',
  }),
  description: z.string().optional(),
})

interface EditScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule: {
    id: string
    name: string
    description?: string | null
  }
  onSuccess?: () => void
}

export function EditScheduleDialog({
  open,
  onOpenChange,
  schedule,
  onSuccess,
}: EditScheduleDialogProps) {
  const { toast } = useToast()
  const updateScheduleMutation = useUpdateSchedule()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: schedule.name,
      description: schedule.description || '',
    },
  })

  // Update form values when schedule changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: schedule.name,
        description: schedule.description || '',
      })
    }
  }, [open, schedule, form])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await updateScheduleMutation.mutateAsync({
        id: schedule.id,
        name: values.name,
        description: values.description,
      })

      toast({
        title: 'Succès',
        description: "L'emploi du temps a été mis à jour.",
      })

      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || "Une erreur est survenue lors de la mise à jour.",
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Modifier l'emploi du temps</DialogTitle>
          <DialogDescription>
            Modifiez le nom et la description de cet emploi du temps.
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={updateScheduleMutation.isPending}>
                {updateScheduleMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
