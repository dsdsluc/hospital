import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";

export function SiteLogo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-3", className)}>
      <span className="relative grid size-11 place-items-center rounded-[1.1rem] bg-primary text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-transform group-hover:-rotate-3">
        <HeartPulse className="size-5" strokeWidth={2.4} />
        <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-background bg-[var(--brand-coral)]" />
      </span>
      <span className="leading-none">
        <span className="block text-lg font-semibold tracking-[-0.04em]">MediPath</span>
        <span className="mt-1 block text-[0.65rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Care made clear
        </span>
      </span>
    </Link>
  );
}
