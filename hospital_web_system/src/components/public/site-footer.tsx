import { Mail, MapPin, Phone } from "lucide-react";
import { SiteLogo } from "./site-logo";

export function SiteFooter() {
  return (
    <footer id="contact" className="border-t bg-[#f4f8f6]">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <SiteLogo />
          <p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">Nền tảng quản lý hành trình khám bệnh từ lịch hẹn, phòng chức năng đến kết quả chuyên môn.</p>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          <div><h3 className="text-sm font-semibold">Khám phá</h3><div className="mt-4 grid gap-3 text-sm text-muted-foreground"><a href="#services">Dịch vụ</a><a href="#journey">Hành trình khám</a><a href="#facilities">Hệ thống phòng</a></div></div>
          <div><h3 className="text-sm font-semibold">Tài khoản</h3><div className="mt-4 grid gap-3 text-sm text-muted-foreground"><a href="/auth/login">Đăng nhập</a><a href="/auth/register">Đăng ký Patient</a></div></div>
          <div><h3 className="text-sm font-semibold">Liên hệ</h3><div className="mt-4 grid gap-3 text-sm text-muted-foreground"><span className="flex gap-2"><Phone className="mt-0.5 size-4 text-primary" />1900 1234</span><span className="flex gap-2"><Mail className="mt-0.5 size-4 text-primary" />support@medipath.vn</span><span className="flex gap-2"><MapPin className="mt-0.5 size-4 text-primary" />Thông tin sẽ cập nhật</span></div></div>
        </div>
      </div>
      <div className="border-t"><div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-8"><span>© 2026 MediPath.</span><span>Giao diện thử nghiệm cho hệ thống quản lý bệnh viện.</span></div></div>
    </footer>
  );
}
