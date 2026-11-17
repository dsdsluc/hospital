"use client";

import { FormEvent, useState, type ComponentType } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import DatePicker, { registerLocale, type ReactDatePickerCustomHeaderProps } from "react-datepicker";
import { format, isSameDay } from "date-fns";
import { vi } from "date-fns/locale";
import {
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  LoaderCircle,
  Moon,
  Sun,
  Sunrise,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { appointmentService } from "@/services/appointment.service";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

registerLocale("vi", vi);

/** Tạo các mốc giờ cách nhau 30 phút, tính cả mốc cuối. */
function buildSlots(fromHour: number, toHour: number, toMinute = 30): string[] {
  const slots: string[] = [];
  for (let hour = fromHour; hour <= toHour; hour += 1) {
    for (const minute of [0, 30]) {
      if (hour === toHour && minute > toMinute) break;
      slots.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
  }
  return slots;
}

const timeSlotGroups: Array<{ label: string; icon: ComponentType<{ className?: string }>; slots: string[] }> = [
  { label: "Buổi sáng", icon: Sunrise, slots: buildSlots(7, 11) },
  { label: "Buổi chiều", icon: Sun, slots: buildSlots(12, 16) },
  { label: "Buổi tối", icon: Moon, slots: buildSlots(17, 20, 0) },
];

const pickerTriggerClassName =
  "flex h-11 w-full items-center gap-2.5 rounded-xl border border-input bg-background px-3 text-left text-sm outline-none transition hover:border-primary/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 data-popup-open:border-ring data-popup-open:ring-3 data-popup-open:ring-ring/20";

export function AppointmentDialog({ triggerVariant = "button" }: { triggerVariant?: "button" | "card" }) {
  const [open, setOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState<Date | null>(null);
  const [appointmentTime, setAppointmentTime] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const queryClient = useQueryClient();
  const createAppointment = useMutation({
    mutationFn: appointmentService.create,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["appointments", "me"] });
      setOpen(false);
      setAppointmentDate(null);
      setAppointmentTime(null);
      toast.success(result.message, { description: `Mã lịch hẹn: ${result.appointment.appointment_code}` });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể đặt lịch khám. Vui lòng thử lại.")),
  });

  const isToday = appointmentDate ? isSameDay(appointmentDate, now) : false;
  const currentTime = format(now, "HH:mm");
  const isSlotDisabled = (slot: string) => isToday && slot <= currentTime;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setNow(new Date());
  }

  function handleDateChange(date: Date | null) {
    const latestNow = new Date();
    setNow(latestNow);
    setAppointmentDate(date);
    setDateOpen(false);
    if (date && appointmentTime && isSameDay(date, latestNow) && appointmentTime <= format(latestNow, "HH:mm")) {
      setAppointmentTime(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appointmentDate || !appointmentTime) {
      toast.error("Vui lòng chọn đầy đủ ngày và giờ khám.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const note = String(formData.get("note") ?? "").trim();
    createAppointment.mutate({
      appointment_date: format(appointmentDate, "yyyy-MM-dd"),
      appointment_time: appointmentTime,
      ...(note && { note }),
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {triggerVariant === "button" ? (
        <DialogTrigger render={<Button className="h-11 rounded-full px-5 shadow-lg shadow-primary/15" />}>
          <CalendarPlus className="size-4" /> Đặt lịch khám mới
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<button type="button" className="group flex w-full items-center gap-4 rounded-2xl border border-border/70 bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md" />}>
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><CalendarPlus className="size-5" /></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold">Đặt lịch khám</span><span className="mt-0.5 block text-xs text-muted-foreground">Chọn ngày và giờ khám</span></span>
          <ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
        </DialogTrigger>
      )}

      <DialogContent className="max-h-[calc(100vh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <DialogHeader className="border-b px-5 py-5 pr-14 sm:px-6">
          <div className="mb-1 grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <CalendarPlus className="size-5" />
          </div>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Đặt lịch khám mới
          </DialogTitle>
          <DialogDescription>
            Chọn thời gian phù hợp và mô tả ngắn tình trạng hiện tại của bạn.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-5 py-6 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  <CalendarDays className="size-4 text-primary" /> Ngày khám
                </Label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger render={<button type="button" className={pickerTriggerClassName} />}>
                    <CalendarDays className="size-4 text-primary" />
                    {appointmentDate ? (
                      <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                        <span className="text-foreground">{format(appointmentDate, "dd/MM/yyyy")}</span>
                        <span className="truncate text-xs capitalize text-muted-foreground">{format(appointmentDate, "EEEE", { locale: vi })}</span>
                      </span>
                    ) : (
                      <span className="flex-1 text-muted-foreground">Chọn ngày khám</span>
                    )}
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </PopoverTrigger>
                  <PopoverContent className="p-3">
                    <DatePicker
                      inline
                      selected={appointmentDate}
                      onChange={handleDateChange}
                      minDate={now}
                      locale="vi"
                      calendarStartDay={1}
                      calendarClassName="appointment-calendar"
                      renderCustomHeader={CalendarHeader}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>
                  <Clock3 className="size-4 text-primary" /> Giờ dự kiến
                </Label>
                <Popover open={timeOpen} onOpenChange={(nextOpen) => { setTimeOpen(nextOpen); if (nextOpen) setNow(new Date()); }}>
                  <PopoverTrigger render={<button type="button" className={pickerTriggerClassName} />}>
                    <Clock3 className="size-4 text-primary" />
                    <span className={cn("flex-1", appointmentTime ? "text-foreground" : "text-muted-foreground")}>{appointmentTime ?? "Chọn khung giờ"}</span>
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] p-3">
                    <div className="space-y-3">
                      {timeSlotGroups.map(({ label, icon: Icon, slots }) => (
                        <div key={label}>
                          <p className="mb-1.5 flex items-center gap-1.5 px-0.5 text-xs font-medium text-muted-foreground"><Icon className="size-3.5" /> {label}</p>
                          <div className="grid grid-cols-4 gap-1.5">
                            {slots.map((slot) => {
                              const disabled = isSlotDisabled(slot);
                              const selected = appointmentTime === slot;
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  disabled={disabled}
                                  aria-pressed={selected}
                                  onClick={() => { setAppointmentTime(slot); setTimeOpen(false); }}
                                  className={cn(
                                    "h-8 rounded-lg text-sm tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                                    selected
                                      ? "bg-primary font-medium text-primary-foreground"
                                      : "bg-muted/60 text-foreground hover:bg-primary/10 hover:text-primary",
                                    disabled && "cursor-not-allowed bg-transparent text-muted-foreground/40 line-through hover:bg-transparent hover:text-muted-foreground/40",
                                  )}
                                >
                                  {slot}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 border-t pt-2.5 text-xs text-muted-foreground">
                      {isToday ? "Các khung giờ đã qua trong hôm nay không thể chọn." : "Mỗi khung giờ cách nhau 30 phút, từ 07:00 đến 20:00."}
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appointment-note">
                <FileText className="size-4 text-primary" /> Tình trạng hiện tại
              </Label>
              <Textarea
                id="appointment-note"
                name="note"
                required
                minLength={10}
                rows={4}
                placeholder="Ví dụ: Tôi bị đau đầu và sốt nhẹ trong 2 ngày gần đây..."
                className="min-h-28 resize-none rounded-xl p-3"
              />
              <p className="text-xs text-muted-foreground">
                Thông tin này giúp bệnh viện chuẩn bị tốt hơn trước buổi khám.
              </p>
            </div>
          </div>

          <DialogFooter className="m-0 rounded-none px-5 py-4 sm:px-6">
            <DialogClose render={<Button type="button" variant="outline" className="h-10 rounded-full px-5" />}>
              Hủy
            </DialogClose>
            <Button type="submit" disabled={createAppointment.isPending} className="h-10 rounded-full px-6">
              {createAppointment.isPending ? <><LoaderCircle className="animate-spin" /> Đang đặt lịch...</> : "Xác nhận đặt lịch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CalendarHeader({ monthDate, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }: ReactDatePickerCustomHeaderProps) {
  const navButtonClassName = "grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30";
  return (
    <div className="flex items-center justify-between px-1 pb-2">
      <button type="button" onClick={decreaseMonth} disabled={prevMonthButtonDisabled} aria-label="Tháng trước" className={navButtonClassName}>
        <ChevronLeft className="size-4" />
      </button>
      <p className="text-sm font-semibold text-foreground">{format(monthDate, "'Tháng' M, yyyy")}</p>
      <button type="button" onClick={increaseMonth} disabled={nextMonthButtonDisabled} aria-label="Tháng sau" className={navButtonClassName}>
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
