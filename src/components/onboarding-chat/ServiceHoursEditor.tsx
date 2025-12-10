import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export interface ServiceHoursData {
  timezone?: string;
  blocks: Array<{
    day: string;
    start: string;
    end: string;
  }>;
}

export interface ServiceHoursEditorProps {
  initialData?: ServiceHoursData;
  onSubmit: (hours: ServiceHoursData) => void;
  onCancel?: () => void;
}

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

const TIME_OPTIONS = [
  "00:00", "01:00", "02:00", "03:00", "04:00", "05:00",
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"
];

export function ServiceHoursEditor({ initialData, onSubmit, onCancel }: ServiceHoursEditorProps) {
  // Parse initial data if present
  const initialDays = new Set<string>();
  let initialStart = "09:00";
  let initialEnd = "17:00";

  if (initialData?.blocks && initialData.blocks.length > 0) {
    initialData.blocks.forEach(block => {
      initialDays.add(block.day);
      // Assuming uniform hours for now as per UI limitation
      initialStart = block.start;
      initialEnd = block.end;
    });
  } else {
    // Default
    ["monday", "tuesday", "wednesday", "thursday", "friday"].forEach(d => initialDays.add(d));
  }

  const [selectedDays, setSelectedDays] = useState<Set<string>>(initialDays);
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(initialEnd);

  const handleDayToggle = (day: string) => {
    const newDays = new Set(selectedDays);
    if (newDays.has(day)) {
      newDays.delete(day);
    } else {
      newDays.add(day);
    }
    setSelectedDays(newDays);
  };

  const handleSubmit = () => {
    const blocks = Array.from(selectedDays).map(day => ({
      day,
      start: startTime,
      end: endTime
    }));

    onSubmit({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      blocks
    });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card animate-in slide-in-from-bottom-2 duration-300">
      <div>
        <Label className="text-base font-semibold mb-3 block">Select Days</Label>
        <div className="grid grid-cols-2 gap-2">
          {DAYS.map(day => (
            <div key={day} className="flex items-center space-x-2">
              <Checkbox
                id={day}
                checked={selectedDays.has(day)}
                onCheckedChange={() => handleDayToggle(day)}
              />
              <Label
                htmlFor={day}
                className="text-sm font-normal capitalize cursor-pointer"
              >
                {day}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start-time" className="text-sm mb-2 block">
            Start Time
          </Label>
          <Select value={startTime} onValueChange={setStartTime}>
            <SelectTrigger id="start-time">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map(time => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="end-time" className="text-sm mb-2 block">
            End Time
          </Label>
          <Select value={endTime} onValueChange={setEndTime}>
            <SelectTrigger id="end-time">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map(time => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={selectedDays.size === 0}
        >
          Save Hours
        </Button>
      </div>
    </div>
  );
}
