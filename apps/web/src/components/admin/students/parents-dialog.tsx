"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Mail, Phone } from "lucide-react";
import {
  createParentSchema,
  createStudentParentRelationSchema,
  type Student,
  type Parent,
  type CreateParent,
} from "@novaconnect/core";

interface ParentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  parents: Array<{
    id: string;
    relationship: string;
    isPrimary: boolean;
    canPickup: boolean;
    canViewGrades: boolean;
    canViewAttendance: boolean;
    parent: Parent;
  }>;
  onCreateParent: (data: CreateParent) => Promise<void>;
  onDeleteRelation: (relationId: string) => Promise<void>;
}

export function ParentsDialog({
  open,
  onOpenChange,
  student,
  parents,
  onCreateParent,
  onDeleteRelation,
}: ParentsDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const form = useForm<CreateParent>({
    resolver: zodResolver(createParentSchema),
    defaultValues: {
      schoolId: student?.schoolId || "",
      firstName: "",
      lastName: "",
      relationship: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      occupation: "",
      workplace: "",
      isPrimaryContact: false,
      isEmergencyContact: false,
    },
  });

  const handleSubmit = async (data: CreateParent) => {
    if (!student) return;

    try {
      setIsSubmitting(true);
      await onCreateParent(data);
      form.reset();
      setShowAddForm(false);
    } catch (error) {
      console.error("Error creating parent:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Gérer les parents</DialogTitle>
          <DialogDescription>
            {student
              ? `Gérer les parents/tuteurs de ${student.firstName} ${student.lastName}`
              : "Gérer les parents/tuteurs"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {parents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun parent associé
                </p>
              ) : (
                parents.map((relation) => (
                  <div
                    key={relation.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-semibold">
                            {relation.parent.firstName} {relation.parent.lastName}
                          </p>
                          {relation.parent.isPrimaryContact && (
                            <Badge variant="secondary">Principal</Badge>
                          )}
                          {relation.parent.isEmergencyContact && (
                            <Badge variant="destructive">Urgence</Badge>
                          )}
                        </div>
                        {relation.relationship && (
                          <p className="text-sm text-muted-foreground">
                            {relation.relationship}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          onDeleteRelation(relation.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {relation.parent.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {relation.parent.phone}
                        </div>
                      )}
                      {relation.parent.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {relation.parent.email}
                        </div>
                      )}
                    </div>

                    {relation.parent.occupation && (
                      <p className="text-sm">
                        <span className="font-medium">Profession:</span>{" "}
                        {relation.parent.occupation}
                        {relation.parent.workplace && ` @ ${relation.parent.workplace}`}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {showAddForm && (
          <div className="border-t pt-4">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénom *</FormLabel>
                        <FormControl>
                          <Input placeholder="Marie" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom *</FormLabel>
                        <FormControl>
                          <Input placeholder="Dupont" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="relationship"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lien de parenté</FormLabel>
                        <FormControl>
                          <Input placeholder="Mère" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone *</FormLabel>
                        <FormControl>
                          <Input placeholder="0612345678" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="marie.dupont@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="occupation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profession</FormLabel>
                        <FormControl>
                          <Input placeholder="Médecin" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-4">
                  <FormField
                    control={form.control}
                    name="isPrimaryContact"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Contact principal</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isEmergencyContact"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Contact d'urgence</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false);
                      form.reset();
                    }}
                    disabled={isSubmitting}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Ajout..." : "Ajouter"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          {!showAddForm && (
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un parent
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
