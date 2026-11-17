"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Phone, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SiteLogo } from "./site-logo";

const navigation = [
  { label: "Dịch vụ", href: "#services" },
  { label: "Hành trình khám", href: "#journey" },
  { label: "Hệ thống phòng", href: "#facilities" },
  { label: "Liên hệ", href: "#contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center px-5 sm:px-8">
        <SiteLogo />
        <nav className="ml-12 hidden items-center gap-7 lg:flex">
          {navigation.map((item) => (
            <a key={item.href} href={item.href} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-3 sm:flex">
          <a href="tel:19001234" className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground xl:flex">
            <Phone className="size-4 text-primary" /> 1900 1234
          </a>
          <Link href="/auth/login" className={cn(buttonVariants({ variant: "ghost" }), "rounded-full")}>Đăng nhập</Link>
          <Link href="/auth/login" className={cn(buttonVariants(), "rounded-full px-5 shadow-sm")}>Đặt lịch khám</Link>
        </div>
        <Button variant="ghost" size="icon" className="ml-auto rounded-full sm:hidden" onClick={() => setOpen((value) => !value)} aria-label="Mở menu">
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <nav className="border-t bg-background px-5 py-4 sm:hidden">
          <div className="mx-auto grid max-w-7xl gap-1">
            {navigation.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted">
                {item.label}
              </a>
            ))}
            <Link href="/auth/login" className={cn(buttonVariants(), "mt-2 rounded-full")}>Đặt lịch khám</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
