"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SiteLogo } from "@/components/public/site-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services/auth.service";
import { authStorage } from "@/lib/auth-storage";
import { getApiErrorMessage } from "@/lib/api-client";

const loginSchema = z.object({
  email: z.email("Vui lòng nhập email hợp lệ."),
  password: z.string().min(6, "Mật khẩu cần ít nhất 6 ký tự."),
  remember: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      const result = await authService.login({ email: values.email, password: values.password });
      authStorage.setAccessToken(result.access_token, values.remember);
      toast.success(result.message);

      const destination = result.user.role === "PATIENT"
        ? "/patient"
        : result.user.role === "DOCTOR"
          ? "/doctor"
          : "/";
      router.replace(destination);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể đăng nhập. Vui lòng thử lại."));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-9 flex items-center justify-between lg:hidden">
          <SiteLogo />
          <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">Trang chủ</Link>
        </div>

        <div>
          <p className="eyebrow">Chào mừng trở lại</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Đăng nhập MediPath</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Sử dụng tài khoản Patient, Doctor hoặc Admin để tiếp tục.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="field-icon" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                aria-invalid={Boolean(errors.email)}
                className="h-11 rounded-xl pl-10"
                {...register("email")}
              />
            </div>
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Mật khẩu</Label>
              <button type="button" className="text-sm font-medium text-primary hover:underline">Quên mật khẩu?</button>
            </div>
            <div className="relative">
              <LockKeyhole className="field-icon" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Nhập mật khẩu"
                aria-invalid={Boolean(errors.password)}
                className="h-11 rounded-xl pl-10 pr-11"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm text-muted-foreground">
            <input type="checkbox" className="size-4 rounded border-input accent-primary" {...register("remember")} />
            Duy trì đăng nhập trên thiết bị này
          </label>

          <Button type="submit" className="h-11 w-full rounded-xl text-sm" disabled={isSubmitting}>
            {isSubmitting ? <><LoaderCircle className="size-4 animate-spin" /> Đang kiểm tra...</> : "Đăng nhập"}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
          <span className="h-px flex-1 bg-border" />Tài khoản mới<span className="h-px flex-1 bg-border" />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Chưa có tài khoản Patient?{" "}
          <Link href="/auth/register" className="font-semibold text-primary hover:underline">Đăng ký ngay</Link>
        </p>

        <div className="mt-7 rounded-2xl border bg-muted/45 p-3.5 text-xs leading-5 text-muted-foreground">
          <strong className="font-semibold text-foreground">Lưu ý bảo mật:</strong> Không chia sẻ mật khẩu hoặc mã truy cập với người khác.
        </div>
      </div>
    </div>
  );
}
