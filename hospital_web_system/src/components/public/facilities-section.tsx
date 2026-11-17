import { ArrowUpRight, Building2, CircleDot } from "lucide-react";

const floors = [
  ["01", "Tiếp nhận & cấp cứu", "Tiếp nhận, phân loại, lấy mẫu và nhà thuốc"],
  ["02", "Khám bệnh ngoại trú", "Khám tổng quát và các chuyên khoa"],
  ["03", "Chẩn đoán & xét nghiệm", "Siêu âm, X-quang, CT, xét nghiệm và điện tim"],
  ["04", "Điều trị & theo dõi", "Nội trú, theo dõi, cách ly và điều dưỡng"],
  ["05", "Phẫu thuật & hồi sức", "Phẫu thuật, hồi tỉnh và chăm sóc tích cực"],
];

export function FacilitiesSection() {
  return (
    <section id="facilities" className="py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <span className="grid size-14 place-items-center rounded-2xl bg-[var(--brand-coral-soft)] text-[var(--brand-coral)]"><Building2 className="size-6" /></span>
          <p className="eyebrow mt-8">Hệ thống cơ sở</p>
          <h2 className="section-title mt-4">Không gian được tổ chức theo chức năng.</h2>
          <p className="mt-5 max-w-md leading-7 text-muted-foreground">Năm tầng và 27 phòng được mô hình hóa rõ ràng để hỗ trợ phân luồng bệnh nhân và quản lý hành trình khám.</p>
        </div>
        <div className="border-t">
          {floors.map(([number, title, copy]) => (
            <article key={number} className="group grid gap-4 border-b py-7 sm:grid-cols-[72px_1fr_auto] sm:items-center">
              <span className="text-sm font-semibold text-primary">T.{number}</span>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p>
              </div>
              <div className="hidden size-10 place-items-center rounded-full border text-muted-foreground transition-all group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground sm:grid"><ArrowUpRight className="size-4" /></div>
            </article>
          ))}
          <div className="mt-7 inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground"><CircleDot className="size-4 text-emerald-500" /> Dữ liệu cơ sở đã sẵn sàng trong hệ thống</div>
        </div>
      </div>
    </section>
  );
}
