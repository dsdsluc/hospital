import type { Metadata } from "next";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Đăng nhập | MediPath",
  description: "Đăng nhập hệ thống quản lý hành trình chăm sóc MediPath.",
};

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[0.9fr_1.1fr]">
      <AuthBrandPanel />
      <LoginForm />
    </main>
  );
}
