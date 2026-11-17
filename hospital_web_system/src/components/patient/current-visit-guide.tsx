"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  DoorOpen,
  Map,
  MapPin,
  Navigation,
  Route,
  LoaderCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { medicalVisitService, type CurrentMedicalVisit, type PatientNavigation } from "@/services/medical-visit.service";
import { formatVnd } from "@/services/price.service";

export function CurrentVisitGuide() {
  const currentVisitQuery = useQuery({
    queryKey: ["my-current-medical-visit"],
    queryFn: medicalVisitService.getMyCurrentVisit,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  });

  const visit = currentVisitQuery.data;
  if (!visit) return null;

  const activeSteps = visit.steps.filter((step) => step.status !== "CANCELLED");
  // Hóa đơn chưa thanh toán → hướng dẫn tới quầy thu ngân trước, kể cả khi lượt khám đã xong.
  const unpaid = visit.invoice?.status === "UNPAID" && visit.cashier_room ? visit.invoice : null;
  const hasFinishedVisit = visit.status === "COMPLETED"
    || (activeSteps.length > 0 && activeSteps.every((step) => step.status === "COMPLETED"));
  if (hasFinishedVisit && !unpaid) return null;

  const destinationStep = getDestinationStep(visit);
  if (!destinationStep && !unpaid) return null;

  const destination = unpaid ? visit.cashier_room! : destinationStep!.room;
  const previousRoom = [...visit.steps]
    .reverse()
    .find((step) => step.status === "COMPLETED")?.room;
  const kind: DestinationKind = unpaid ? "CASHIER" : getDestinationKind(visit, destinationStep!);
  const isInRoom = !unpaid && destinationStep!.status === "IN_PROGRESS" && kind !== "RETURN_FOR_CONCLUSION";
  const remainingServices = visit.steps.filter((step) => (step.status === "PENDING" || step.status === "IN_PROGRESS") && step.room.id !== visit.receiving_room.id && step.room.room_code !== "PHM-105").length;
  const heading = kind === "CASHIER" ? "Thanh toán viện phí"
    : kind === "PHARMACY" ? "Nhận thuốc tại nhà thuốc"
    : kind === "RETURN_FOR_CONCLUSION" ? "Quay lại phòng khám nhận kết luận"
    : isInRoom ? (kind === "EXAM" ? "Bạn đang được khám tại" : "Bạn đang được thực hiện tại")
    : "Điểm đến tiếp theo của bạn";
  const badge = kind === "CASHIER" ? "Chờ thanh toán"
    : kind === "PHARMACY" ? "Đến nhận thuốc"
    : kind === "RETURN_FOR_CONCLUSION" ? "Đã có kết quả"
    : isInRoom ? "Đang thực hiện" : "Vui lòng di chuyển";
  const message = kind === "CASHIER" && unpaid
    ? `Bác sĩ đã hoàn tất khám. Vui lòng đến ${destination.floor.name}, ${destination.name.toLocaleLowerCase("vi")} ${destination.room_code}, đọc mã lượt khám ${visit.visit_code} để thanh toán ${formatVnd(unpaid.total_amount)} (nếu có thẻ BHYT còn hạn, viện phí được giảm 80%). ${unpaid.next_destination === "PHM-105" ? "Sau khi thanh toán, sang nhà thuốc PHM-105 nhận thuốc." : "Sau khi thanh toán, bạn có thể ra về."}`
    : kind === "PHARMACY"
    ? `${visit.invoice?.status === "PAID" ? "Đã thanh toán." : "Bác sĩ đã hoàn tất khám."} Vui lòng đến ${destination.floor.name}, nhà thuốc ${destination.room_code}, đọc mã lượt khám ${visit.visit_code} để nhận thuốc. Lượt khám hoàn thành sau khi nhận thuốc.`
    : kind === "RETURN_FOR_CONCLUSION"
      ? `Đã có đủ kết quả cận lâm sàng. Vui lòng quay lại phòng ${destination.room_code} và chờ bác sĩ gọi để nhận kết luận.`
      : isInRoom
        ? `Vui lòng làm theo hướng dẫn của nhân viên tại phòng ${destination.room_code}.`
        : `Vui lòng đến ${destination.floor.name}, tìm phòng ${destination.room_code} và chờ trước cửa phòng.${remainingServices > 1 ? ` Sau đó còn ${remainingServices - 1} phòng cần thực hiện.` : ""}`;

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-primary/20 bg-card shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><Navigation className="size-4" /></span>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Hướng dẫn lượt khám hiện tại</p>
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight">{heading}</h2>
            </div>
            <Badge className={cn("rounded-full border-0 px-3 py-1.5", kind === "CASHIER" ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : kind === "PHARMACY" || kind === "RETURN_FOR_CONCLUSION" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : isInRoom ? "bg-primary/10 text-primary hover:bg-primary/10" : "bg-amber-100 text-amber-700 hover:bg-amber-100")}>
              {badge}
            </Badge>
          </div>

          <div className="mt-5 flex flex-col gap-4 rounded-2xl bg-muted/55 p-4 sm:flex-row sm:items-center">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><DoorOpen className="size-6" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">Phòng cần đến</p>
              <h3 className="mt-1 text-xl font-semibold">{destination.room_code} · {destination.name}</h3>
              {unpaid && <p className="mt-1 text-sm font-semibold text-primary">Tổng chi phí: {formatVnd(unpaid.total_amount)}<span className="ml-1.5 text-xs font-normal text-muted-foreground">· có BHYT giảm 80%</span></p>}
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-4 text-primary" /> {destination.floor.name} · {destination.function.name}</p>
            </div>
            <div className="shrink-0 rounded-xl bg-background px-4 py-3 text-center shadow-sm">
              <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Mã lượt khám</p>
              <p className="mt-1 font-semibold text-primary">{visit.visit_code}</p>
            </div>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">{message}</p>
        </div>

        <div className="flex flex-col justify-center gap-3 border-t bg-primary/[0.045] p-5 lg:border-l lg:border-t-0">
          <DirectionsDialog visit={visit} previousRoom={previousRoom} fallbackDestination={destination} />
          <JourneyDialog visit={visit} />
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-3.5" /> Tự động cập nhật mỗi 5 giây</p>
        </div>
      </div>
    </section>
  );
}

function DirectionsDialog({ visit, previousRoom, fallbackDestination }: { visit: CurrentMedicalVisit; previousRoom?: CurrentMedicalVisit["receiving_room"]; fallbackDestination: CurrentMedicalVisit["receiving_room"] }) {
  const navigationQuery = useQuery({
    queryKey: ["my-current-navigation", visit.id],
    queryFn: medicalVisitService.getMyCurrentNavigation,
    staleTime: 0,
    refetchOnWindowFocus: "always",
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  });
  const fallbackOrigin = previousRoom ?? visit.receiving_room;
  const navigation = navigationQuery.data;
  const destination = navigation?.destination ?? fallbackDestination;
  const origin = navigation?.origin ?? fallbackOrigin;

  return <Dialog>
    <DialogTrigger render={<Button className="h-11 w-full rounded-full" />}><Map /> Xem chỉ đường</DialogTrigger>
    <DialogContent className="scrollbar-hidden max-h-[calc(100vh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-xl">
      <DialogHeader className="border-b px-5 py-5 pr-14 sm:px-6">
        <div className="mb-1 grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Route className="size-5" /></div>
        <DialogTitle className="text-xl font-semibold">Chỉ đường đến {destination.room_code}</DialogTitle>
        <DialogDescription>Lộ trình được cập nhật theo điểm khám hiện tại của bạn.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 px-5 py-6 sm:px-6">
        <DirectionPoint label="Xuất phát" room={origin} active={false} />
        {navigationQuery.isPending ? <div className="flex items-center gap-3 rounded-2xl bg-muted p-4 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Đang tải lộ trình...</div> : <DirectionSteps navigation={navigation} />}
        <DirectionPoint label="Điểm đến" room={destination} active />
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">Khi đến nơi, vui lòng chờ trước phòng và theo dõi thông báo gọi lượt.</div>
      </div>
      <DialogFooter className="m-0 rounded-none px-5 py-4 sm:px-6"><DialogClose render={<Button className="h-10 rounded-full px-6" />}>Đã hiểu</DialogClose></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function DirectionSteps({ navigation }: { navigation: PatientNavigation | null | undefined }) {
  if (!navigation) return <div className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Chưa thể tải lộ trình chi tiết. Vui lòng hỏi nhân viên tại quầy hướng dẫn.</div>;
  return <div className="ml-6 space-y-3 border-l-2 border-dashed border-primary/25 py-2 pl-6">
    <div className="flex items-center gap-2 text-xs font-semibold text-primary"><Clock3 className="size-4" /> Khoảng {navigation.estimated_minutes} phút</div>
    {navigation.instructions.map((instruction, index) => <div key={instruction} className="flex gap-3 text-sm"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span><p>{instruction}</p></div>)}
  </div>;
}

function JourneyDialog({ visit }: { visit: CurrentMedicalVisit }) {
  return <Dialog>
    <DialogTrigger render={<Button variant="outline" className="h-11 w-full rounded-full bg-background" />}><Route /> Xem hành trình khám</DialogTrigger>
    <DialogContent className="scrollbar-hidden max-h-[calc(100vh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-xl">
      <DialogHeader className="border-b px-5 py-5 pr-14 sm:px-6"><DialogTitle className="text-xl font-semibold">Hành trình khám bệnh</DialogTitle><DialogDescription>Mã lượt khám {visit.visit_code}</DialogDescription></DialogHeader>
      <div className="px-5 py-6 sm:px-6">
        {visit.steps.map((step, index) => <div key={step.id} className="relative flex gap-4 pb-7 last:pb-0">
          {index < visit.steps.length - 1 && <span className="absolute left-[0.9rem] top-8 h-[calc(100%-1.25rem)] w-px bg-border" />}
          <span className={cn("relative z-10 grid size-7 shrink-0 place-items-center rounded-full border-2 bg-background", step.status === "COMPLETED" && "border-primary bg-primary text-primary-foreground", step.status === "IN_PROGRESS" && "border-primary text-primary", step.status === "PENDING" && "border-border text-muted-foreground")}>
            {step.status === "COMPLETED" ? <Check className="size-3.5" /> : <CircleDot className="size-3.5" />}
          </span>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{step.room.function.name}</p><span className="text-xs text-muted-foreground">{statusLabel(step.status)}</span></div><p className="mt-1 text-sm text-muted-foreground">{step.room.room_code} · {step.room.name} · {step.room.floor.name}</p></div>
        </div>)}
      </div>
      <DialogFooter className="m-0 rounded-none px-5 py-4 sm:px-6"><DialogClose render={<Button className="h-10 rounded-full px-6" />}>Đóng</DialogClose></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function DirectionPoint({ label, room, active }: { label: string; room: CurrentMedicalVisit["receiving_room"]; active: boolean }) {
  return <div className={cn("flex items-center gap-4 rounded-2xl border p-4", active && "border-primary/25 bg-primary/[0.05]")}><span className={cn("grid size-11 place-items-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}><MapPin className="size-5" /></span><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{room.room_code} · {room.name}</p><p className="text-xs text-muted-foreground">{room.floor.name}</p></div>{active && <ChevronRight className="ml-auto size-4 text-primary" />}</div>;
}

/**
 * Điểm đến hiện tại của bệnh nhân. Bước tại phòng bác sĩ tiếp nhận luôn "đang thực hiện" cho tới khi
 * hoàn tất khám, nên ưu tiên các phòng khác (cận lâm sàng, nhà thuốc) trước; hết mới quay về phòng bác sĩ.
 */
function getDestinationStep(visit: CurrentMedicalVisit) {
  const active = visit.steps.filter((step) => step.status === "IN_PROGRESS" || step.status === "PENDING");
  const others = active.filter((step) => step.room.id !== visit.receiving_room.id);
  return others.find((step) => step.status === "IN_PROGRESS")
    ?? others.find((step) => step.status === "PENDING")
    ?? active.find((step) => step.room.id === visit.receiving_room.id);
}

type DestinationKind = "CASHIER" | "PHARMACY" | "RETURN_FOR_CONCLUSION" | "EXAM" | "SERVICE";

function getDestinationKind(visit: CurrentMedicalVisit, step: CurrentMedicalVisit["steps"][number]): DestinationKind {
  if (step.room.room_code === "PHM-105") return "PHARMACY";
  if (step.room.id === visit.receiving_room.id) {
    const hasCompletedServices = visit.steps.some((item) => item.status === "COMPLETED" && item.room.id !== visit.receiving_room.id && item.room.room_code !== "REC-101");
    return hasCompletedServices ? "RETURN_FOR_CONCLUSION" : "EXAM";
  }
  return "SERVICE";
}

function statusLabel(status: CurrentMedicalVisit["steps"][number]["status"]) {
  if (status === "COMPLETED") return "Đã hoàn thành";
  if (status === "IN_PROGRESS") return "Đang thực hiện";
  if (status === "CANCELLED") return "Đã hủy";
  return "Điểm đến tiếp theo";
}
