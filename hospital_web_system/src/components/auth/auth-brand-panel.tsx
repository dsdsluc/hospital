import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Quote } from "lucide-react";
import { SiteLogo } from "@/components/public/site-logo";

const content = {
  login: {
    title: "Một tài khoản cho toàn bộ hành trình chăm sóc.",
    description: "Truy cập lịch hẹn, hồ sơ cá nhân và các bước khám đã được kết nối trong hệ thống MediPath.",
    highlights: ["Quản lý lịch khám trong một nơi", "Theo dõi hành trình qua từng phòng", "Kết quả chuyên môn được lưu tập trung"],
  },
  register: {
    title: "Bắt đầu hành trình chăm sóc chủ động hơn.",
    description: "Tạo tài khoản Patient để đặt lịch, cập nhật hồ sơ và theo dõi quá trình khám của chính bạn.",
    highlights: ["Đăng ký nhanh với email", "Thông tin cá nhân được quản lý tập trung", "Sẵn sàng đặt lịch sau khi đăng nhập"],
  },
};

export function AuthBrandPanel({ mode = "login" }: { mode?: keyof typeof content }) {
  const panelContent = content[mode];
  return (
    <section className="relative hidden min-h-screen overflow-hidden bg-[#082f2b] lg:flex lg:flex-col lg:justify-between">
      <Image
        src="/hospital-hero.png"
        alt="Không gian chăm sóc tại MediPath"
        fill
        priority
        sizes="50vw"
        className="object-cover object-[62%_center] opacity-70"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#062d29]/65 via-[#062d29]/55 to-[#062d29]/95" />
      <div className="relative z-10 flex items-center justify-between p-8 xl:p-10">
        <SiteLogo className="text-white [&_span:last-child_span]:text-white/60" />
        <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/15">
          <ArrowLeft className="size-4" /> Trang chủ
        </Link>
      </div>
      <div className="relative z-10 p-8 xl:p-10">
        <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-emerald-300 backdrop-blur"><Quote className="size-5" /></span>
        <h1 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.045em] text-white xl:text-4xl">
          {panelContent.title}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-white/65">
          {panelContent.description}
        </p>
        <div className="mt-7 grid gap-2.5">
          {panelContent.highlights.map((item) => (
            <div key={item} className="flex items-center gap-3 text-sm text-white/80">
              <CheckCircle2 className="size-3.5 text-emerald-300" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
