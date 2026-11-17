"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Home,
  LogOut,
  Menu,
  UserRound,
  X,
} from "lucide-react";

import { SiteLogo } from "@/components/public/site-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { authStorage } from "@/lib/auth-storage";
import { patientService } from "@/services/patient.service";
import { NotificationBell } from "@/components/patient/notifications/notification-bell";

const navigation: Array<{ label: string; href: string; icon: typeof Home; tooltip?: string }> = [
  { label: "Tổng quan", href: "/patient", icon: Home },
  { label: "Lịch khám", href: "/patient/appointments", icon: CalendarDays, tooltip: "Xem, đặt và quản lý lịch hẹn" },
  { label: "Hồ sơ khám", href: "/patient/visits", icon: ClipboardList, tooltip: "Kết quả khám và đơn thuốc" },
];

/** Trang con (vd. /patient/appointments/history) vẫn làm sáng mục cha trên menu. */
function isActive(pathname: string, href: string) {
  return href === "/patient" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function PatientHeader() {
  const pathname = usePathname();
  const profileQuery = useQuery({ queryKey: ["patient-profile"], queryFn: patientService.getMyProfile });
  const patientName = profileQuery.data?.full_name ?? "Bệnh nhân";
  const initials = patientName.split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function handleScroll() {
      const currentScrollY = window.scrollY;
      const scrollDifference = currentScrollY - lastScrollY.current;

      if (currentScrollY < 24) {
        setHeaderVisible(true);
        lastScrollY.current = currentScrollY;
      } else if (scrollDifference > 8) {
        setHeaderVisible(false);
        setMobileOpen(false);
        setProfileOpen(false);
        lastScrollY.current = currentScrollY;
      } else if (scrollDifference < -8) {
        setHeaderVisible(true);
        lastScrollY.current = currentScrollY;
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={cn("sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl transition-transform duration-300 ease-out will-change-transform", headerVisible ? "translate-y-0" : "-translate-y-full")}>
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-8 px-4 sm:px-6 lg:px-8">
        <SiteLogo />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Điều hướng bệnh nhân">
          {navigation.map(({ label, href, icon: Icon, tooltip }) => (
            <span key={href} className="group/nav-tip relative inline-flex">
              <Link
                href={href}
                aria-describedby={tooltip ? `nav-tip-${href}` : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  isActive(pathname, href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
              {tooltip && (
                <span
                  id={`nav-tip-${href}`}
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-max max-w-56 -translate-x-1/2 -translate-y-1 rounded-xl bg-foreground px-3 py-2 text-center text-xs font-medium leading-5 text-background opacity-0 shadow-xl transition group-hover/nav-tip:translate-y-0 group-hover/nav-tip:opacity-100 group-focus-within/nav-tip:translate-y-0 group-focus-within/nav-tip:opacity-100"
                >
                  {tooltip}
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-foreground" />
                </span>
              )}
            </span>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />

          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setProfileOpen((value) => !value)}
              className="flex items-center gap-3 rounded-full border border-border/80 bg-card py-1.5 pl-1.5 pr-3 text-left shadow-sm transition hover:border-primary/25"
              aria-expanded={profileOpen}
            >
              <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{initials || "BN"}</span>
              <span className="hidden leading-tight md:block">
                <span className="block max-w-32 truncate text-sm font-semibold">{patientName}</span>
                <span className="block text-xs text-muted-foreground">Bệnh nhân</span>
              </span>
              <ChevronDown className={cn("size-4 text-muted-foreground transition", profileOpen && "rotate-180")} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-2xl border bg-card p-2 shadow-xl shadow-foreground/5">
                <Link href="/patient/profile" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-muted">
                  <UserRound className="size-4 text-muted-foreground" /> Hồ sơ cá nhân
                </Link>
                <Link href="/auth/login" onClick={() => authStorage.removeAccessToken()} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10">
                  <LogOut className="size-4" /> Đăng xuất
                </Link>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon-lg"
            className="rounded-full lg:hidden"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label="Mở menu"
          >
            {mobileOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t bg-background px-4 py-3 lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-1">
            {navigation.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium", isActive(pathname, href) ? "bg-primary/10 text-primary" : "hover:bg-muted")}
              >
                <Icon className="size-4" /> {label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
