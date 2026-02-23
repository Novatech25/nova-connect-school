'use client';

import { useDroppable } from '@dnd-kit/core';
import { ScheduleSlot, DayOfWeek, groupSlotsByDay } from '@novaconnect/core';
import SlotCard from './SlotCard';

interface TimeGridProps {
  slots: ScheduleSlot[];
  conflicts: Map<string, string[]>;
  onEditSlot: (slot: ScheduleSlot) => void;
  onDeleteSlot: (slotId: string) => void;
}

// Time slots configuration
const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00', '21:00', '22:00'
];

const DAYS: DayOfWeek[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
};

export default function TimeGrid({
  slots,
  conflicts,
  onEditSlot,
  onDeleteSlot,
}: TimeGridProps) {
  const slotsByDay = groupSlotsByDay(slots);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1200px]">
        <div className="grid grid-cols-7 gap-px border rounded-lg overflow-hidden">
          {/* Header row */}
          <div className="bg-muted p-2 font-semibold text-sm"></div>
          {DAYS.map((day) => (
            <div
              key={day}
              className="bg-muted p-2 font-semibold text-sm text-center"
            >
              {DAY_LABELS[day]}
            </div>
          ))}

          {/* Time rows */}
          {TIME_SLOTS.map((time, timeIndex) => (
            <div key={time} className="contents">
              {/* Time label */}
              <div className="bg-muted/50 p-2 text-sm text-muted-foreground flex items-center justify-center font-mono">
                {time}
              </div>

              {/* Day columns */}
              {DAYS.map((day) => (
                <DroppableCell
                  key={`${day}-${time}`}
                  id={`${day}-${time}`}
                  day={day}
                  time={time}
                  slots={slotsByDay[day]?.filter((s) => {
                    const slotHour = parseInt(s.startTime.split(':')[0]);
                    const timeHour = parseInt(time.split(':')[0]);
                    return slotHour === timeHour;
                  }) || []}
                  conflicts={conflicts}
                  onEditSlot={onEditSlot}
                  onDeleteSlot={onDeleteSlot}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface DroppableCellProps {
  id: string;
  day: DayOfWeek;
  time: string;
  slots: ScheduleSlot[];
  conflicts: Map<string, string[]>;
  onEditSlot: (slot: ScheduleSlot) => void;
  onDeleteSlot: (slotId: string) => void;
}

function DroppableCell({
  id,
  day,
  time,
  slots,
  conflicts,
  onEditSlot,
  onDeleteSlot,
}: DroppableCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] p-2 bg-background border-l first:border-l-0 transition-colors ${
        isOver ? 'bg-primary/10' : ''
      }`}
    >
      <div className="space-y-1">
        {slots.map((slot) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            hasConflict={conflicts.has(slot.id)}
            onEdit={() => onEditSlot(slot)}
            onDelete={() => onDeleteSlot(slot.id)}
          />
        ))}
      </div>
    </div>
  );
}
