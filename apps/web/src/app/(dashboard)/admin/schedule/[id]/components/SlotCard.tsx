'use client';

import { useDraggable } from '@dnd-kit/core';
import { GripVertical, Edit, Trash2, Clock, User, Users, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScheduleSlot } from '@novaconnect/core';
import { useMemo } from 'react';

interface SlotCardProps {
  slot: ScheduleSlot;
  hasConflict: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export default function SlotCard({ slot, hasConflict, onEdit, onDelete }: SlotCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: slot.id,
    data: slot,
  });

  // Use data already loaded from getWithSlots query
  // The query includes: teacher, class, subject, room, campus relations
  const teacher = (slot as any).teacher;
  const classData = (slot as any).class;
  const subject = (slot as any).subject;
  const room = (slot as any).room;

  // Compute display name safely
  const teacherDisplayName = useMemo(() => {
    if (!teacher) return 'Professeur inconnu';

    // Extract data from teacher object
    const firstName = teacher.firstName || teacher.first_name;
    const lastName = teacher.lastName || teacher.last_name;

    if (firstName && lastName) return `${firstName} ${lastName}`;
    return firstName || lastName || teacher.email || 'Professeur sans nom';
  }, [teacher]);

  // Calculate duration from startTime and endTime
  const [startHour, startMin] = slot.startTime.split(':').map(Number);
  const [endHour, endMin] = slot.endTime.split(':').map(Number);
  const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group relative h-full min-h-[100px] rounded-md border p-2 shadow-sm transition-all hover:shadow-md hover:border-primary/50 ${isDragging ? 'opacity-50 scale-95 z-50 ring-2 ring-primary' : ''
        } ${hasConflict ? 'border-destructive/50 bg-destructive/10' : 'bg-card hover:bg-accent/5'}`}
    >
      {/* Drag handle */}
      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing">
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>

      {/* Conflict badge */}
      {hasConflict && (
        <div className="absolute top-1 right-1">
          <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
            !
          </Badge>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col h-full gap-1.5 pl-1 pt-1">
        {/* Subject - Prominent */}
        {subject ? (
          <div className="font-semibold text-sm text-primary leading-tight line-clamp-2">
            {subject.name}
          </div>
        ) : (
          <div className="font-semibold text-sm text-muted-foreground italic">Matière inconnue</div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-1 gap-0.5 text-xs text-muted-foreground mt-auto">
          {/* Time */}
          <div className="flex items-center gap-1.5 font-medium text-foreground/80">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{slot.startTime} - {slot.endTime}</span>
          </div>

          {/* Class */}
          {classData && (
            <div className="flex items-center gap-1.5">
              <Users className="h-3 w-3 shrink-0" />
              <span className="truncate">{classData.name}</span>
            </div>
          )}

          {/* Teacher */}
          {teacher && (
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{teacherDisplayName}</span>
            </div>
          )}

          {/* Room */}
          {room && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{room.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-card/80 backdrop-blur-sm rounded-md border shadow-sm p-0.5 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-primary/10 hover:text-primary"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          title="Modifier"
        >
          <Edit className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Supprimer"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
