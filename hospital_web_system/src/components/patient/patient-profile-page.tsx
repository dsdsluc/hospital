"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInYears, format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Droplets,
  Edit3,
  Fingerprint,
  HeartPulse,
  Home,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Ruler,
  Save,
  UserRound,
  VenusAndMars,
  Weight,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PatientHeader } from "@/components/patient/patient-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-client";
import { authService } from "@/services/auth.service";
import { patientService } from "@/services/patient.service";
import type { BloodType, Gender } from "@/types/api";

const genderLabels: Record<Gender, string> = { MALE: "Nam", FEMALE: "Nữ", OTHER: "Khác" };
const bloodTypeLabels: Record<BloodType, string> = {
  A_POSITIVE: "A+", A_NEGATIVE: "A-", B_POSITIVE: "B+", B_NEGATIVE: "B-",
  AB_POSITIVE: "AB+", AB_NEGATIVE: "AB-", O_POSITIVE: "O+", O_NEGATIVE: "O-",
};

export function PatientProfilePage() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ["patients", "me"], queryFn: patientService.getMyProfile });
  const userQuery = useQuery({ queryKey: ["auth", "me", "profile-page"], queryFn: authService.getCurrentUser });

  if (profileQuery.isPending) {
    return <div className="grid min-h-screen place-items-center bg-muted/35"><div className="text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-primary" /><p className="mt-3 text-sm font-medium">Đang tải hồ sơ bệnh nhân...</p></div></div>;
  }

  if (profileQuery.isError) {
    return <div className="grid min-h-screen place-items-center bg-muted/35 px-5"><div className="w-full max-w-md rounded-3xl border bg-card p-7 text-center shadow-sm"><HeartPulse className="mx-auto size-8 text-destructive" /><h1 className="mt-4 text-xl font-semibold">Không thể tải hồ sơ</h1><p className="mt-2 text-sm text-muted-foreground">Hồ sơ bệnh nhân không tồn tại hoặc kết nối API đang gặp sự cố.</p><div className="mt-5 flex justify-center gap-2"><Button variant="outline" render={<Link href="/patient" />}><ArrowLeft /> Quay lại</Button><Button onClick={() => profileQuery.refetch()}>Thử lại</Button></div></div></div>;
  }

  const profile = profileQuery.data;
  const dateOfBirth = profile.date_of_birth ? parseISO(profile.date_of_birth) : null;
  const bmi = profile.weight_kg && profile.height_cm ? profile.weight_kg / ((profile.height_cm / 100) ** 2) : null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--background)_0%,oklch(0.975_0.012_170)_100%)]">
      <PatientHeader />
      <main className="mx-auto max-w-6xl px-4 pb-14 pt-7 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground"><Link href="/patient" className="flex items-center gap-1.5 hover:text-foreground"><Home className="size-3.5" /> Tổng quan</Link><span>/</span><span className="text-foreground">Hồ sơ cá nhân</span></nav>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.75fr)]">
          <div className="space-y-6">
            <EditablePersonalInformation
              profile={profile}
              email={userQuery.data?.email ?? null}
              phoneNumber={userQuery.data?.phone_number ?? null}
              dateOfBirth={dateOfBirth}
              onUpdated={async () => {
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ["patients", "me"] }),
                  queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
                ]);
              }}
            />
          </div>

          <aside className="space-y-6">
            <ProfileSection title="Chỉ số sức khỏe" description="Thông tin cơ bản gần nhất" icon={HeartPulse}>
              <div className="grid grid-cols-2 gap-3"><HealthMetric icon={Droplets} label="Nhóm máu" value={profile.blood_type ? bloodTypeLabels[profile.blood_type] : null} /><HealthMetric icon={Ruler} label="Chiều cao" value={profile.height_cm ? `${profile.height_cm} cm` : null} /><HealthMetric icon={Weight} label="Cân nặng" value={profile.weight_kg ? `${profile.weight_kg} kg` : null} /><HealthMetric icon={Activity} label="BMI" value={bmi ? bmi.toFixed(1) : null} /></div>
            </ProfileSection>

            <section className="rounded-[1.5rem] border bg-card p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Thông tin hệ thống</p><dl className="mt-4 space-y-3 text-sm"><SystemRow label="Mã bệnh nhân" value={profile.patient_code ?? "—"} /><SystemRow label="Ngày tạo hồ sơ" value={format(parseISO(profile.created_at), "dd/MM/yyyy")} /><SystemRow label="Cập nhật gần nhất" value={format(parseISO(profile.updated_at), "dd/MM/yyyy HH:mm")} /></dl></section>
          </aside>
        </div>
      </main>
    </div>
  );
}

function ProfileSection({ title, description, icon: Icon, children }: { title: string; description: string; icon: typeof UserRound; children: React.ReactNode }) {
  return <section className="rounded-[1.5rem] border bg-card p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3 border-b pb-4"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-[1.1rem]" /></span><div><h2 className="font-semibold">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div></div><div className="mt-4">{children}</div></section>;
}

function EditablePersonalInformation({ profile, email, phoneNumber, dateOfBirth, onUpdated }: { profile: import("@/types/api").PatientProfile; email: string | null; phoneNumber: string | null; dateOfBirth: Date | null; onUpdated: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const updateProfile = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      const data = new FormData(form);
      const dateValue = String(data.get("date_of_birth") ?? "");
      const genderValue = String(data.get("gender") ?? "");
      const identityValue = String(data.get("identity_number") ?? "").trim();
      const addressValue = String(data.get("address") ?? "").trim();
      const phoneValue = String(data.get("phone_number") ?? "").trim();

      await Promise.all([
        patientService.updateMyProfile({
          full_name: String(data.get("full_name") ?? "").trim(),
          date_of_birth: dateValue || null,
          gender: (genderValue || null) as Gender | null,
          identity_number: identityValue || null,
          address: addressValue || null,
        }),
        authService.updateCurrentUser({
          email: String(data.get("email") ?? "").trim(),
          phone_number: phoneValue || null,
        }),
      ]);
    },
    onSuccess: async () => {
      await onUpdated();
      setEditing(false);
      toast.success("Cập nhật thông tin cá nhân thành công.");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể cập nhật hồ sơ.")),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateProfile.mutate(event.currentTarget);
  }

  return (
    <section className="rounded-[1.5rem] border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3 border-b pb-4">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-[1.1rem]" /></span>
        <div className="min-w-0 flex-1"><h2 className="font-semibold">Thông tin cá nhân và liên hệ</h2><p className="mt-0.5 text-xs text-muted-foreground">Thông tin định danh và tài khoản của bệnh nhân</p></div>
        {!editing && <Button variant="outline" onClick={() => setEditing(true)} className="rounded-full"><Edit3 /> Chỉnh sửa</Button>}
      </div>

      {editing ? (
        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <EditField label="Họ và tên" icon={UserRound} wide><Input name="full_name" defaultValue={profile.full_name} required minLength={2} maxLength={150} className="h-11 rounded-xl px-3" /></EditField>
            <EditField label="Email" icon={Mail}><Input name="email" type="email" defaultValue={email ?? ""} required className="h-11 rounded-xl px-3" /></EditField>
            <EditField label="Số điện thoại" icon={Phone}><Input name="phone_number" type="tel" defaultValue={phoneNumber ?? ""} minLength={8} maxLength={20} className="h-11 rounded-xl px-3" /></EditField>
            <EditField label="Ngày sinh" icon={CalendarDays}><Input name="date_of_birth" type="date" defaultValue={profile.date_of_birth?.slice(0, 10) ?? ""} className="h-11 rounded-xl px-3" /></EditField>
            <EditField label="Giới tính" icon={VenusAndMars}><select name="gender" defaultValue={profile.gender ?? ""} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"><option value="">Chưa cập nhật</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></EditField>
            <EditField label="Số CCCD" icon={Fingerprint}><Input name="identity_number" defaultValue={profile.identity_number ?? ""} maxLength={30} className="h-11 rounded-xl px-3" /></EditField>
            <EditField label="Địa chỉ" icon={MapPin} wide><Textarea name="address" defaultValue={profile.address ?? ""} rows={3} maxLength={500} className="min-h-24 resize-none rounded-xl p-3" /></EditField>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={updateProfile.isPending} className="rounded-full px-5"><X /> Hủy</Button><Button type="submit" disabled={updateProfile.isPending} className="rounded-full px-5">{updateProfile.isPending ? <LoaderCircle className="animate-spin" /> : <Save />} Lưu thay đổi</Button></div>
        </form>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><ProfileItem icon={UserRound} label="Họ và tên" value={profile.full_name} wide /><ProfileItem icon={Mail} label="Email" value={email} /><ProfileItem icon={Phone} label="Số điện thoại" value={phoneNumber} /><ProfileItem icon={CalendarDays} label="Ngày sinh" value={dateOfBirth ? format(dateOfBirth, "dd/MM/yyyy", { locale: vi }) : null} detail={dateOfBirth ? `${differenceInYears(new Date(), dateOfBirth)} tuổi` : undefined} /><ProfileItem icon={VenusAndMars} label="Giới tính" value={profile.gender ? genderLabels[profile.gender] : null} /><ProfileItem icon={Fingerprint} label="Số CCCD" value={profile.identity_number} /><ProfileItem icon={MapPin} label="Địa chỉ" value={profile.address} wide /></div>
      )}
    </section>
  );
}

function EditField({ label, icon: Icon, wide, children }: { label: string; icon: typeof UserRound; wide?: boolean; children: React.ReactNode }) {
  return <div className={wide ? "sm:col-span-2" : ""}><Label className="mb-2"><Icon className="size-4 text-primary" /> {label}</Label>{children}</div>;
}

function ProfileItem({ icon: Icon, label, value, detail, wide }: { icon: typeof UserRound; label: string; value?: string | null; detail?: string; wide?: boolean }) {
  return <div className={`rounded-2xl bg-muted/55 p-4 ${wide ? "sm:col-span-2" : ""}`}><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-3.5 text-primary" /> {label}</div><p className="mt-2 text-sm font-semibold">{value || "Chưa cập nhật"}</p>{detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}</div>;
}

function HealthMetric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string | null }) {
  return <div className="rounded-2xl bg-muted/55 p-4"><Icon className="size-4 text-primary" /><p className="mt-3 text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value || "--"}</p></div>;
}

function SystemRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>;
}

