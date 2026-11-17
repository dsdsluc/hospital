"use client";

import { FormEvent, useState } from "react";
import DatePicker from "react-datepicker";
import {
  CalendarDays,
  ChevronDown,
  Droplets,
  Fingerprint,
  FileHeart,
  MapPin,
  Ruler,
  UserRoundPen,
  VenusAndMars,
  Weight,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ProfileDialog({ triggerVariant = "edit" }: { triggerVariant?: "edit" | "health" }) {
  const [open, setOpen] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(new Date(1998, 7, 16));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dateOfBirth) {
      toast.error("Vui lòng chọn ngày sinh.");
      return;
    }

    setOpen(false);
    toast.success("Đã cập nhật hồ sơ cá nhân", {
      description: "Thông tin đang được lưu tạm trên giao diện.",
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="group flex w-full items-center gap-4 rounded-2xl border border-border/70 bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
          />
        }
      >
        <span className={triggerVariant === "health" ? "grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700" : "grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700"}>
          {triggerVariant === "health" ? <FileHeart className="size-5" /> : <UserRoundPen className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{triggerVariant === "health" ? "Hồ sơ sức khỏe" : "Cập nhật hồ sơ"}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{triggerVariant === "health" ? "Xem thông tin cá nhân" : "Chỉnh sửa thông tin"}</span>
        </span>
        <ChevronDown className="size-4 -rotate-90 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </DialogTrigger>

      <DialogContent className="scrollbar-hidden max-h-[calc(100vh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-5 pr-14 sm:px-6">
          <div className="mb-1 grid size-11 place-items-center rounded-2xl bg-violet-100 text-violet-700">
            <UserRoundPen className="size-5" />
          </div>
          <DialogTitle className="text-xl font-semibold tracking-tight">Cập nhật hồ sơ</DialogTitle>
          <DialogDescription>
            Kiểm tra và chỉnh sửa thông tin sức khỏe cơ bản của bạn.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 px-5 py-6 sm:px-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Thông tin cá nhân</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <ProfileField label="Họ và tên" icon={UserRoundPen} className="sm:col-span-2">
                  <Input name="fullName" defaultValue="An Nguyễn" required className="h-11 rounded-xl px-3" />
                </ProfileField>

                <ProfileField label="Ngày sinh" icon={CalendarDays}>
                  <DatePicker
                    selected={dateOfBirth}
                    onChange={setDateOfBirth}
                    dateFormat="dd/MM/yyyy"
                    locale="vi"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    customInput={<DateOfBirthInput />}
                    popperClassName="appointment-datepicker-popper"
                  />
                </ProfileField>

                <ProfileField label="Giới tính" icon={VenusAndMars}>
                  <select name="gender" defaultValue="MALE" className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20">
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </ProfileField>

                <ProfileField label="Số CCCD" icon={Fingerprint}>
                  <Input name="identityNumber" inputMode="numeric" defaultValue="079098001234" className="h-11 rounded-xl px-3" />
                </ProfileField>

                <ProfileField label="Nhóm máu" icon={Droplets}>
                  <select name="bloodType" defaultValue="O+" className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20">
                    <option value="UNKNOWN">Chưa xác định</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </ProfileField>
              </div>
            </section>

            <div className="h-px bg-border" />

            <section className="space-y-4">
              <h3 className="text-sm font-semibold">Chỉ số và địa chỉ</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <ProfileField label="Chiều cao (cm)" icon={Ruler}>
                  <Input name="height" type="number" min="50" max="250" defaultValue="168" className="h-11 rounded-xl px-3" />
                </ProfileField>
                <ProfileField label="Cân nặng (kg)" icon={Weight}>
                  <Input name="weight" type="number" min="2" max="500" step="0.1" defaultValue="62" className="h-11 rounded-xl px-3" />
                </ProfileField>
                <ProfileField label="Địa chỉ" icon={MapPin} className="sm:col-span-2">
                  <Textarea name="address" rows={3} defaultValue="Quận 1, Thành phố Hồ Chí Minh" className="min-h-20 resize-none rounded-xl p-3" />
                </ProfileField>
              </div>
            </section>
          </div>

          <DialogFooter className="m-0 rounded-none px-5 py-4 sm:px-6">
            <DialogClose render={<Button type="button" variant="outline" className="h-10 rounded-full px-5" />}>
              Hủy thay đổi
            </DialogClose>
            <Button type="submit" className="h-10 rounded-full px-6">Lưu hồ sơ</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProfileField({ label, icon: Icon, className, children }: { label: string; icon: typeof UserRoundPen; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-2"><Icon className="size-4 text-primary" /> {label}</Label>
      {children}
    </div>
  );
}

const DateOfBirthInput = ({ value, onClick }: { value?: string; onClick?: () => void }) => (
  <button type="button" onClick={onClick} className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-input bg-background px-3 text-left text-sm outline-none transition hover:border-primary/40 focus:border-ring focus:ring-3 focus:ring-ring/20">
    <CalendarDays className="size-4 text-primary" />
    <span className="flex-1">{value || "Chọn ngày sinh"}</span>
    <ChevronDown className="size-4 text-muted-foreground" />
  </button>
);
