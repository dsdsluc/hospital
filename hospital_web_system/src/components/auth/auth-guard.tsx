"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, LockKeyhole, ShieldAlert } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { authStorage } from "@/lib/auth-storage";
import { cn } from "@/lib/utils";
import { authService } from "@/services/auth.service";
import type { UserRole } from "@/types/api";

type AuthGuardProps = {
  children: ReactNode;
  allowedRoles: UserRole[];
};

function subscribeToAuthStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("hospital-auth-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("hospital-auth-change", onStoreChange);
  };
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const accessToken = useSyncExternalStore(
    subscribeToAuthStorage,
    () => authStorage.getAccessToken(),
    () => null,
  );

  const currentUserQuery = useQuery({
    queryKey: ["auth", "me", accessToken],
    queryFn: () => authService.getCurrentUser(),
    enabled: Boolean(accessToken),
    retry: false,
    staleTime: 60_000,
  });

  if (!accessToken) {
    return (
      <AccessMessage
        icon="login"
        title="Bạn chưa đăng nhập"
        description="Vui lòng đăng nhập để truy cập khu vực được bảo vệ này."
      />
    );
  }

  if (currentUserQuery.isPending) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/35 px-5">
        <div className="text-center">
          <LoaderCircle className="mx-auto size-7 animate-spin text-primary" />
          <p className="mt-3 text-sm font-medium">Đang kiểm tra quyền truy cập...</p>
        </div>
      </div>
    );
  }

  if (currentUserQuery.isError || !currentUserQuery.data) {
    return (
      <AccessMessage
        icon="login"
        title="Phiên đăng nhập không hợp lệ"
        description="Access token đã hết hạn hoặc không còn hợp lệ. Vui lòng đăng nhập lại."
      />
    );
  }

  if (!allowedRoles.includes(currentUserQuery.data.role)) {
    const correctArea = currentUserQuery.data.role === "DOCTOR" ? "/doctor" : currentUserQuery.data.role === "PATIENT" ? "/patient" : "/";
    return (
      <AccessMessage
        icon="forbidden"
        title="Bạn không có quyền truy cập"
        description={`Khu vực này không dành cho tài khoản ${currentUserQuery.data.role}.`}
        correctArea={correctArea}
      />
    );
  }

  return children;
}

function AccessMessage({ icon, title, description, correctArea }: { icon: "login" | "forbidden"; title: string; description: string; correctArea?: string }) {
  const Icon = icon === "login" ? LockKeyhole : ShieldAlert;

  function clearSession() {
    authStorage.removeAccessToken();
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,var(--secondary),var(--background)_45%)] px-5 py-12">
      <div className="w-full max-w-md rounded-[1.75rem] border bg-card p-7 text-center shadow-xl shadow-foreground/5">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-6" /></span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {correctArea && <Link href={correctArea} className={cn(buttonVariants(), "h-10 rounded-full px-5")}>Đến khu vực của tôi</Link>}
          <Button variant={correctArea ? "outline" : "default"} onClick={clearSession} render={<Link href="/auth/login" />} className="h-10 rounded-full px-5">Đăng nhập lại</Button>
        </div>
        <Link href="/" className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground">Quay về trang chủ</Link>
      </div>
    </div>
  );
}
