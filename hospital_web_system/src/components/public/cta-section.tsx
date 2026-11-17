import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CtaSection() {
  return (
    <section id="booking" className="px-4 pb-24 sm:px-6 sm:pb-32 lg:px-8">
      <div className="relative mx-auto overflow-hidden rounded-[2rem] bg-primary px-7 py-14 text-primary-foreground sm:px-12 lg:flex lg:items-center lg:justify-between lg:px-16 lg:py-16">
        <div className="absolute -right-20 -top-32 size-80 rounded-full border-[55px] border-white/10" />
        <div className="relative max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">Bắt đầu hành trình</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-balance">Chủ động đặt lịch, nhẹ nhàng hơn khi đi khám.</h2>
          <p className="mt-4 max-w-xl leading-7 text-white/70">Đăng nhập bằng tài khoản bệnh nhân để chọn ngày giờ và quản lý lịch khám của bạn.</p>
        </div>
        <Link href="/auth/login" className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "relative mt-8 h-13 rounded-full px-7 lg:mt-0")}>
          <CalendarDays className="size-5" /> Đặt lịch ngay <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
