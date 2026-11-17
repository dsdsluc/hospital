import { Activity, FlaskConical, HeartPulse, ScanLine, Stethoscope, Tablets } from "lucide-react";

const services = [
  { icon: Stethoscope, title: "Khám tổng quát", copy: "Tiếp nhận ban đầu và điều phối hành trình khám phù hợp." },
  { icon: FlaskConical, title: "Xét nghiệm", copy: "Thực hiện lấy mẫu và ghi nhận kết quả tập trung." },
  { icon: ScanLine, title: "Chẩn đoán hình ảnh", copy: "Siêu âm, X-quang và CT trong hệ thống phòng chuyên môn." },
  { icon: HeartPulse, title: "Theo dõi lâm sàng", copy: "Kết nối kết quả từ các phòng về bác sĩ tiếp nhận." },
  { icon: Activity, title: "Cấp cứu & theo dõi", copy: "Phân luồng rõ ràng cho các trường hợp cần ưu tiên." },
  { icon: Tablets, title: "Quản lý thuốc", copy: "Danh mục thuốc và tồn kho sẵn sàng cho quy trình kê đơn." },
];

export function ServicesSection() {
  return (
    <section id="services" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="eyebrow">Dịch vụ kết nối</p>
            <h2 className="section-title mt-4">Mỗi điểm chạm đều nằm trong cùng một hành trình.</h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground lg:justify-self-end">
            Hệ thống được tổ chức quanh luồng khám thực tế: tiếp nhận, phòng chức năng, kết quả và quay lại bác sĩ phụ trách.
          </p>
        </div>
        <div className="mt-12 grid overflow-hidden rounded-[1.75rem] border bg-card sm:grid-cols-2 lg:grid-cols-3">
          {services.map(({ icon: Icon, title, copy }, index) => (
            <article key={title} className="group border-b p-7 transition-colors hover:bg-primary/[0.035] sm:border-r lg:p-8 [&:nth-last-child(-n+3)]:lg:border-b-0">
              <div className="flex items-start justify-between">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
                <span className="text-xs font-semibold text-muted-foreground/55">0{index + 1}</span>
              </div>
              <h3 className="mt-7 text-lg font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
