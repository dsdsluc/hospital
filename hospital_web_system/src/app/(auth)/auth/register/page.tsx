import type { Metadata } from "next";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Đăng ký Patient | MediPath",
  description: "Tạo tài khoản Patient trên hệ thống MediPath.",
};

export default function RegisterPage() {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[0.9fr_1.1fr]">
      <AuthBrandPanel mode="register" />
      <RegisterForm />
    </main>
  );
}
