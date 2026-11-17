"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SiteLogo } from "@/components/public/site-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services/auth.service";
import { authStorage } from "@/lib/auth-storage";
import { getApiErrorMessage } from "@/lib/api-client";

const registerSchema = z
  .object({
    full_name: z.string().trim().min(2, "Họ và tên cần ít nhất 2 ký tự.").max(150),
    email: z.email("Vui lòng nhập email hợp lệ."),
    phone_number: z.string().trim().max(20, "Số điện thoại không hợp lệ."),
    password: z.string().min(6, "Mật khẩu cần ít nhất 6 ký tự.").max(72),
    confirm_password: z.string(),
    accept_terms: z.boolean().refine(Boolean, "Bạn cần đồng ý với điều khoản."),
  })
  .refine((data) => data.password === data.confirm_password, {
    path: ["confirm_password"],
    message: "Mật khẩu xác nhận chưa khớp.",
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [visibleField, setVisibleField] = useState<"password" | "confirm" | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: "", email: "", phone_number: "", password: "", confirm_password: "", accept_terms: false },
  });
  const passwordLength = (useWatch({ control, name: "password" }) ?? "").length;
  const strength = passwordLength === 0 ? 0 : passwordLength < 6 ? 1 : passwordLength < 10 ? 2 : 3;

  async function onSubmit(values: RegisterFormValues) {
    try {
      const result = await authService.register({
        full_name: values.full_name,
        email: values.email,
        phone_number: values.phone_number.trim() || undefined,
        password: values.password,
      });
      authStorage.setAccessToken(result.access_token, true);
      toast.success(result.message, { description: "Hồ sơ bệnh nhân đã được tạo." });
      router.replace("/patient");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể đăng ký. Vui lòng thử lại."));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex items-center justify-between lg:hidden">
          <SiteLogo />
          <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">Trang chủ</Link>
        </div>

        <div>
          <p className="eyebrow">Dành cho bệnh nhân</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Tạo tài khoản Patient</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Bắt đầu với thông tin đăng nhập cơ bản. Hồ sơ sức khỏe có thể cập nhật sau.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-3.5" noValidate>
          <Field label="Họ và tên" error={errors.full_name?.message}>
            <UserRound className="field-icon" />
            <Input id="register-full-name" autoComplete="name" placeholder="Nguyễn Văn An" aria-invalid={Boolean(errors.full_name)} className="h-11 rounded-xl pl-10" {...register("full_name")} />
          </Field>

          <Field label="Email" error={errors.email?.message}>
            <Mail className="field-icon" />
            <Input id="register-email" type="email" autoComplete="email" placeholder="name@example.com" aria-invalid={Boolean(errors.email)} className="h-11 rounded-xl pl-10" {...register("email")} />
          </Field>

          <Field label="Số điện thoại (không bắt buộc)" error={errors.phone_number?.message}>
            <Phone className="field-icon" />
            <Input id="register-phone" type="tel" autoComplete="tel" placeholder="0901 234 567" aria-invalid={Boolean(errors.phone_number)} className="h-11 rounded-xl pl-10" {...register("phone_number")} />
          </Field>

          <Field label="Mật khẩu" error={errors.password?.message}>
            <LockKeyhole className="field-icon" />
            <Input id="register-password" type={visibleField === "password" ? "text" : "password"} autoComplete="new-password" placeholder="Tối thiểu 6 ký tự" aria-invalid={Boolean(errors.password)} className="h-11 rounded-xl pl-10 pr-11" {...register("password")} />
            <PasswordToggle visible={visibleField === "password"} onClick={() => setVisibleField((value) => value === "password" ? null : "password")} />
          </Field>

          <div className="flex gap-1.5" aria-label="Độ mạnh mật khẩu">
            {[1, 2, 3].map((level) => <span key={level} className={`h-1 flex-1 rounded-full ${strength >= level ? "bg-primary" : "bg-muted"}`} />)}
          </div>

          <Field label="Xác nhận mật khẩu" error={errors.confirm_password?.message}>
            <LockKeyhole className="field-icon" />
            <Input id="confirm-password" type={visibleField === "confirm" ? "text" : "password"} autoComplete="new-password" placeholder="Nhập lại mật khẩu" aria-invalid={Boolean(errors.confirm_password)} className="h-11 rounded-xl pl-10 pr-11" {...register("confirm_password")} />
            <PasswordToggle visible={visibleField === "confirm"} onClick={() => setVisibleField((value) => value === "confirm" ? null : "confirm")} />
          </Field>

          <div>
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-muted-foreground">
              <input type="checkbox" className="mt-1 size-4 rounded border-input accent-primary" {...register("accept_terms")} />
              <span>Tôi đồng ý với <button type="button" className="font-medium text-primary hover:underline">điều khoản sử dụng</button> và chính sách bảo mật.</span>
            </label>
            {errors.accept_terms && <p className="mt-1 text-sm text-destructive">{errors.accept_terms.message}</p>}
          </div>

          <Button type="submit" className="h-11 w-full rounded-xl text-sm" disabled={isSubmitting}>
            {isSubmitting ? <><LoaderCircle className="size-4 animate-spin" /> Đang tạo tài khoản...</> : "Tạo tài khoản"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Đã có tài khoản? <Link href="/auth/login" className="font-semibold text-primary hover:underline">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">{children}</div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function PasswordToggle({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
      {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
    </button>
  );
}
