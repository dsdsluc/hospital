import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HeroSection() {
  return (
    <section id="home" className="px-4 pt-5 sm:px-6 lg:px-8">
      <div className="relative mx-auto min-h-[650px] max-w-[1440px] overflow-hidden rounded-[2rem] bg-[#e9f3ef] sm:min-h-[690px] lg:min-h-[720px]">
        <Image src="/hospital-hero.png" alt="Bác sĩ tư vấn cho bệnh nhân trong không gian bệnh viện hiện đại" fill priority sizes="(max-width: 768px) 100vw, 1440px" className="object-cover object-[65%_center]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#f7fbf9] via-[#f7fbf9]/95 via-42% to-transparent" />
        <div className="relative z-10 flex min-h-[650px] items-center sm:min-h-[690px] lg:min-h-[720px]">
          <div className="w-full max-w-3xl px-7 py-16 sm:px-12 lg:px-20">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/75 px-4 py-2 text-sm font-medium text-primary shadow-sm backdrop-blur">
              <span className="size-2 rounded-full bg-[var(--brand-coral)]" />
              Một hành trình khám rõ ràng, liền mạch
            </div>
            <h1 className="mt-7 max-w-[760px] text-5xl font-semibold leading-[0.98] tracking-[-0.06em] text-balance sm:text-6xl lg:text-[5.25rem]">
              Chăm sóc sức khỏe, <span className="text-primary">được kết nối</span> từ đầu đến cuối.
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Đặt lịch nhanh, theo dõi hành trình qua từng phòng chức năng và nhận kết quả khám trong một hệ thống thống nhất.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/auth/login" className={cn(buttonVariants({ size: "lg" }), "h-13 rounded-full px-7 text-base shadow-lg")}>
                <CalendarDays className="size-5" /> Đặt lịch khám
              </Link>
              <a href="#journey" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-13 rounded-full border-primary/15 bg-white/70 px-7 text-base backdrop-blur")}>
                Xem quy trình <ArrowRight className="size-4" />
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-foreground/75">
              {["Đặt lịch trực tuyến", "Kết quả tập trung", "Theo dõi hồ sơ cá nhân"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" />{item}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="absolute bottom-5 right-5 hidden rounded-2xl border border-white/60 bg-white/80 p-4 shadow-xl backdrop-blur-md md:block">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mô hình vận hành</p>
          <div className="mt-2 flex items-end gap-5">
            <div><strong className="text-2xl tracking-tight">5</strong><span className="ml-1 text-sm text-muted-foreground">tầng</span></div>
            <div className="h-7 w-px bg-border" />
            <div><strong className="text-2xl tracking-tight">27</strong><span className="ml-1 text-sm text-muted-foreground">phòng</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
