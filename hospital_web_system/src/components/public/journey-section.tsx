import { ClipboardCheck, FlaskConical, Hospital, Stethoscope } from "lucide-react";

const steps = [
  { icon: ClipboardCheck, number: "01", title: "Đặt lịch", copy: "Chọn ngày, giờ và mô tả tình trạng ban đầu." },
  { icon: Stethoscope, number: "02", title: "Bác sĩ tiếp nhận", copy: "Khám sơ bộ và chỉ định các phòng chức năng cần thiết." },
  { icon: FlaskConical, number: "03", title: "Thực hiện chỉ định", copy: "Đi qua xét nghiệm, siêu âm hoặc chẩn đoán hình ảnh theo nhu cầu." },
  { icon: Hospital, number: "04", title: "Quay lại phòng khám", copy: "Bác sĩ tiếp nhận tổng hợp kết quả và đưa ra hướng xử lý." },
];

export function JourneySection() {
  return (
    <section id="journey" className="bg-[#082f2b] py-24 text-white sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Hành trình khám</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">Không cần đoán bước tiếp theo của bạn là gì.</h2>
          <p className="mt-5 max-w-2xl leading-7 text-white/65">Mỗi ca khám bắt đầu từ một phòng tiếp nhận cố định, đi qua các phòng chức năng cần thiết và quay lại đúng nơi để bác sĩ tổng hợp kết quả.</p>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-[1.75rem] bg-white/10 md:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, number, title, copy }) => (
            <article key={number} className="relative bg-[#0b3934] p-7 lg:min-h-72 lg:p-8">
              <span className="text-sm font-medium text-emerald-300">{number}</span>
              <Icon className="mt-12 size-7 text-white" />
              <h3 className="mt-5 text-xl font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/60">{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
