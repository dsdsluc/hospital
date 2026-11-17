"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  Activity,
  Check,
  ClipboardPlus,
  Copy,
  FileCheck2,
  HeartPulse,
  Hourglass,
  LoaderCircle,
  Pill,
  Plus,
  Ruler,
  Save,
  Search,
  Send,
  Stethoscope,
  Thermometer,
  Trash2,
  Weight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ReceptionQueueAppointment } from "@/types/api";
import { flagStyle, getBmi, getVitalFlag } from "@/components/doctor/workspaces/reception-measure-dialog";
import { Paragraphs } from "@/components/patient/paragraphs";
import { OrderResultList, OrdersDialog, OrdersPanel, getVisitOrders } from "@/components/doctor/workspaces/orders-panel";
import { getApiErrorMessage } from "@/lib/api-client";
import { SpecialtyPanel, getSpecialty, type SpecialtyValue } from "@/components/doctor/workspaces/specialty/registry";
import { medicalVisitService, type AvailableMedicine, type SavePrescriptionPayload } from "@/services/medical-visit.service";

type ExaminationWorkspaceProps = {
  roomCode: string;
  roomName: string;
  appointment: ReceptionQueueAppointment;
};

/** SPECIALTY: tab riêng của chuyên khoa (PED-204, INT-203, ENT-205, DER-206); GEN-201/202 không có. */
type WorkspaceTab = "INITIAL_EXAM" | "SPECIALTY" | "ORDERS" | "CONCLUSION" | "PRESCRIPTION";

type PrescriptionDraftItem = {
  key: string;
  medicine_id: string;
  dosage: string;
  quantity: string;
  usage: string;
};

const tabs = [
  { value: "INITIAL_EXAM" as const, label: "Khám ban đầu", icon: Stethoscope },
  { value: "ORDERS" as const, label: "Chỉ định", icon: ClipboardPlus },
  { value: "CONCLUSION" as const, label: "Kết luận", icon: FileCheck2 },
  { value: "PRESCRIPTION" as const, label: "Đơn thuốc", icon: Pill },
];

export function ExaminationWorkspace({ roomCode, roomName, appointment }: ExaminationWorkspaceProps) {
  const visit = appointment.medical_visits[0]!;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<WorkspaceTab>("INITIAL_EXAM");
  const [ordersDialogOpen, setOrdersDialogOpen] = useState(false);
  const pendingOrderCount = getVisitOrders(visit.steps ?? []).filter((order) => order.status !== "COMPLETED").length;
  const [preliminaryDiagnosis, setPreliminaryDiagnosis] = useState(visit?.examination_record?.preliminary_diagnosis ?? "");
  const [nextEvaluation, setNextEvaluation] = useState(visit?.examination_record?.next_evaluation ?? "");
  // Phòng chuyên khoa (PED/INT/ENT/DER) có thêm một tab riêng ngay sau "Khám ban đầu"; GEN giữ nguyên.
  const specialty = getSpecialty(roomCode);
  const visibleTabs = specialty ? [tabs[0], { value: "SPECIALTY" as const, label: specialty.tabLabel, icon: specialty.icon }, ...tabs.slice(1)] : tabs;
  const [clinicalFindings, setClinicalFindings] = useState(visit?.examination_record?.clinical_findings ?? "");
  const [specialtyData, setSpecialtyData] = useState<SpecialtyValue | null>(() => specialty?.read(visit?.examination_record?.specialty_data) ?? null);
  const [finalDiagnosis, setFinalDiagnosis] = useState(visit?.examination_record?.final_diagnosis ?? "");
  const [treatmentDirection, setTreatmentDirection] = useState(visit?.examination_record?.treatment_direction ?? "");
  const [conclusion, setConclusion] = useState(visit?.examination_record?.conclusion ?? "");
  const [doctorAdvice, setDoctorAdvice] = useState(visit?.examination_record?.doctor_advice ?? "");
  const [prescriptionNote, setPrescriptionNote] = useState(visit?.prescription?.note ?? "");
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionDraftItem[]>(() => visit?.prescription?.items.map((item) => ({
    key: item.id,
    medicine_id: item.medicine_id,
    dosage: item.dosage ?? "",
    quantity: String(item.quantity),
    usage: item.usage ?? "",
  })) ?? []);
  const footerAction = getFooterAction(tab, pendingOrderCount, prescriptionItems.length);
  const FooterActionIcon = footerAction.icon;
  const medicinesQuery = useQuery({
    queryKey: ["available-medicines"],
    queryFn: medicalVisitService.getAvailableMedicines,
    enabled: tab === "PRESCRIPTION",
  });
  const refreshWorkspace = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["room-visit-queue", roomCode] }),
      queryClient.invalidateQueries({ queryKey: ["my-current-medical-visit"] }),
    ]);
  };
  // Trạng thái lưu của phần "Khám ban đầu": so với giá trị đã lưu gần nhất.
  const [savedInitialExam, setSavedInitialExam] = useState(() => ({
    preliminaryDiagnosis: (visit?.examination_record?.preliminary_diagnosis ?? "").trim(),
    nextEvaluation: (visit?.examination_record?.next_evaluation ?? "").trim(),
    clinicalFindings: (visit?.examination_record?.clinical_findings ?? "").trim(),
    specialtyData: JSON.stringify(specialty?.read(visit?.examination_record?.specialty_data) ?? null),
  }));
  const [initialExamSavedAt, setInitialExamSavedAt] = useState<string | null>(() => (visit?.examination_record ? visit.examination_record.updated_at ?? null : null));
  const initialExamDirty = preliminaryDiagnosis.trim() !== savedInitialExam.preliminaryDiagnosis || nextEvaluation.trim() !== savedInitialExam.nextEvaluation || (Boolean(specialty) && (clinicalFindings.trim() !== savedInitialExam.clinicalFindings || JSON.stringify(specialtyData) !== savedInitialExam.specialtyData));
  const initialExaminationMutation = useMutation({
    mutationFn: () => medicalVisitService.saveInitialExamination(visit.id, {
      preliminary_diagnosis: preliminaryDiagnosis.trim() || null,
      next_evaluation: nextEvaluation.trim() || null,
      // Chỉ phòng chuyên khoa gửi khám lâm sàng + dữ liệu chuyên khoa; phòng GEN giữ nguyên như cũ.
      ...(specialty && specialtyData && { clinical_findings: clinicalFindings.trim() || null, specialty_data: specialty.isEmpty(specialtyData) ? null : specialtyData }),
    }),
    onSuccess: async (result) => {
      setSavedInitialExam({ preliminaryDiagnosis: preliminaryDiagnosis.trim(), nextEvaluation: nextEvaluation.trim(), clinicalFindings: clinicalFindings.trim(), specialtyData: JSON.stringify(specialtyData) });
      setInitialExamSavedAt(new Date().toISOString());
      await refreshWorkspace();
      toast.success(result.message);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể lưu thông tin khám ban đầu.")),
  });
  // Trạng thái lưu của phần "Kết luận".
  const conclusionSnapshot = () => ({ finalDiagnosis: finalDiagnosis.trim(), treatmentDirection: treatmentDirection.trim(), conclusion: conclusion.trim(), doctorAdvice: doctorAdvice.trim() });
  const [savedConclusion, setSavedConclusion] = useState(() => ({
    finalDiagnosis: (visit?.examination_record?.final_diagnosis ?? "").trim(),
    treatmentDirection: (visit?.examination_record?.treatment_direction ?? "").trim(),
    conclusion: (visit?.examination_record?.conclusion ?? "").trim(),
    doctorAdvice: (visit?.examination_record?.doctor_advice ?? "").trim(),
  }));
  const hasSavedConclusion = Boolean(savedConclusion.finalDiagnosis || savedConclusion.treatmentDirection || savedConclusion.conclusion || savedConclusion.doctorAdvice);
  const [conclusionSavedAt, setConclusionSavedAt] = useState<string | null>(() => (hasSavedConclusion ? visit?.examination_record?.updated_at ?? null : null));
  const conclusionDirty = JSON.stringify(conclusionSnapshot()) !== JSON.stringify(savedConclusion);
  const conclusionMutation = useMutation({
    mutationFn: () => medicalVisitService.saveConclusion(visit.id, {
      final_diagnosis: finalDiagnosis.trim() || null,
      treatment_direction: treatmentDirection.trim() || null,
      conclusion: conclusion.trim() || null,
      doctor_advice: doctorAdvice.trim() || null,
    }),
    onSuccess: async (result) => {
      setSavedConclusion(conclusionSnapshot());
      setConclusionSavedAt(new Date().toISOString());
      await refreshWorkspace();
      toast.success(result.message);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể lưu kết luận.")),
  });
  // Đơn thuốc đã xác nhận gần nhất (để biết có thay đổi chưa gửi).
  const [savedPrescription, setSavedPrescription] = useState(() => JSON.stringify(buildPrescriptionPayload(prescriptionItems, prescriptionNote)));
  const prescriptionConfirmedAt = visit?.prescription?.confirmed_at ?? null;
  const prescriptionDirty = JSON.stringify(buildPrescriptionPayload(prescriptionItems, prescriptionNote)) !== savedPrescription;
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const prescriptionMutation = useMutation({
    mutationFn: () => medicalVisitService.savePrescription(visit.id, buildPrescriptionPayload(prescriptionItems, prescriptionNote)),
    onSuccess: async (result) => {
      setSavedPrescription(JSON.stringify(buildPrescriptionPayload(prescriptionItems, prescriptionNote)));
      setCompleteDialogOpen(false);
      await refreshWorkspace();
      toast.success(result.message);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể xác nhận đơn thuốc.")),
  });
  const isSaving = initialExaminationMutation.isPending || conclusionMutation.isPending || prescriptionMutation.isPending;

  function handleFooterAction() {
    if (tab === "ORDERS") {
      setOrdersDialogOpen(true);
      return;
    }
    if (tab === "CONCLUSION") {
      conclusionMutation.mutate();
      return;
    }
    if (tab === "PRESCRIPTION") {
      if (prescriptionItems.some((item) => !item.medicine_id)) return toast.error("Vui lòng chọn thuốc cho tất cả các dòng.");
      const overStock = prescriptionItems.find((item) => getItemIssues(item, medicinesQuery.data ?? []).overStock);
      if (overStock) return toast.error("Có thuốc vượt số lượng tồn kho. Vui lòng chỉnh lại đơn thuốc.");
      setCompleteDialogOpen(true);
      return;
    }
    initialExaminationMutation.mutate();
  }

  return (
    <div className="overflow-hidden rounded-[1.4rem] border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Stethoscope className="size-4" /></span>
        <h2 className="text-[0.95rem] font-semibold">Phiếu khám hiện tại</h2>
        <span className="hidden h-5 w-px bg-border sm:block" />
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">{roomCode} · {roomName}</p>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700"><span className="size-1.5 rounded-full bg-amber-500" /> Đang khám</span>
      </div>

      <div className="border-b px-3 pt-3 sm:px-5">
        <div className="flex gap-1 overflow-x-auto scrollbar-hidden">
          {visibleTabs.map(({ value, label, icon: Icon }) => (
            <button key={value} type="button" title={`Mở khu vực ${label.toLocaleLowerCase("vi")}`} aria-label={`Mở khu vực ${label}`} onClick={() => setTab(value)} className={cn("relative flex shrink-0 items-center gap-2 rounded-t-xl px-4 py-3 text-sm font-medium transition", tab === value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <Icon className="size-4" /> {label}
              {value === "ORDERS" && pendingOrderCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary text-[0.65rem] text-primary-foreground">{pendingOrderCount}</span>}
              {tab === value && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
      </div>

      {tab === "INITIAL_EXAM" && <ExaminationForm appointment={appointment} preliminaryDiagnosis={preliminaryDiagnosis} nextEvaluation={nextEvaluation} onPreliminaryDiagnosisChange={setPreliminaryDiagnosis} onNextEvaluationChange={setNextEvaluation} onGoToOrders={() => setTab("ORDERS")} />}
      {tab === "SPECIALTY" && specialty && specialtyData && <SpecialtyPanel specialty={specialty} value={specialtyData} onChange={setSpecialtyData} appointment={appointment} clinicalFindings={clinicalFindings} onClinicalFindingsChange={setClinicalFindings} SectionHeading={SectionHeading} />}
      {tab === "ORDERS" && <OrdersPanel visitId={visit.id} steps={visit.steps ?? []} onOpenDialog={() => setOrdersDialogOpen(true)} />}
      <OrdersDialog open={ordersDialogOpen} onOpenChange={setOrdersDialogOpen} visitId={visit.id} steps={visit.steps ?? []} onSent={refreshWorkspace} />
      {tab === "CONCLUSION" && <ConclusionPanel visitId={visit.id} steps={visit.steps ?? []} preliminaryDiagnosis={preliminaryDiagnosis} values={{ finalDiagnosis, treatmentDirection, conclusion, doctorAdvice }} onChange={{ setFinalDiagnosis, setTreatmentDirection, setConclusion, setDoctorAdvice }} onGoToOrders={() => setTab("ORDERS")} />}
      <CompleteVisitDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        finalDiagnosis={finalDiagnosis}
        conclusionDirty={conclusionDirty}
        onSaveConclusion={() => conclusionMutation.mutate()}
        isSavingConclusion={conclusionMutation.isPending}
        pendingOrderCount={pendingOrderCount}
        items={prescriptionItems}
        medicines={medicinesQuery.data ?? []}
        isSubmitting={prescriptionMutation.isPending}
        onConfirm={() => prescriptionMutation.mutate()}
      />
      {tab === "PRESCRIPTION" && <PrescriptionPanel medicines={medicinesQuery.data ?? []} isLoading={medicinesQuery.isPending} items={prescriptionItems} note={prescriptionNote} onNoteChange={setPrescriptionNote} onItemsChange={setPrescriptionItems} />}

      <div className="flex flex-col-reverse gap-2 border-t bg-muted/35 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        {((tab === "INITIAL_EXAM" || tab === "SPECIALTY") && initialExamDirty) || (tab === "CONCLUSION" && conclusionDirty) ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700"><span className="size-1.5 rounded-full bg-amber-500" /> Có thay đổi chưa lưu</p>
        ) : (tab === "INITIAL_EXAM" || tab === "SPECIALTY") && initialExamSavedAt ? (
          <SavedAt value={initialExamSavedAt} />
        ) : tab === "CONCLUSION" && conclusionSavedAt ? (
          <SavedAt value={conclusionSavedAt} />
        ) : tab === "PRESCRIPTION" && prescriptionDirty ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700"><span className="size-1.5 rounded-full bg-amber-500" /> Đơn thuốc chưa xác nhận</p>
        ) : tab === "PRESCRIPTION" && prescriptionConfirmedAt ? (
          <SavedAt value={prescriptionConfirmedAt} label="Đơn thuốc đã xác nhận lúc" />
        ) : (
          <p className="text-xs text-muted-foreground">{footerAction.description}</p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
        {tab === "CONCLUSION" && <EscalateObservationDialog visitId={visit.id} diagnosis={finalDiagnosis || preliminaryDiagnosis} reception={visit.reception_record} onTransferred={refreshWorkspace} />}
        <Hint content={footerAction.tooltip}><Button type="button" disabled={isSaving} className="h-10 rounded-full px-6" onClick={handleFooterAction}>{isSaving ? <LoaderCircle className="animate-spin" /> : <FooterActionIcon />} {isSaving ? "Đang xử lý..." : footerAction.label}</Button></Hint>
        </div>
      </div>
    </div>
  );
}

function ExaminationForm({ appointment, preliminaryDiagnosis, nextEvaluation, onPreliminaryDiagnosisChange, onNextEvaluationChange, onGoToOrders }: {
  appointment: ReceptionQueueAppointment;
  preliminaryDiagnosis: string;
  nextEvaluation: string;
  onPreliminaryDiagnosisChange: (value: string) => void;
  onNextEvaluationChange: (value: string) => void;
  onGoToOrders: () => void;
}) {
  const receptionRecord = appointment.medical_visits[0]?.reception_record;
  const visitReason = receptionRecord?.visit_reason || appointment.note;
  const receptionNote = receptionRecord?.reception_note;
  const height = receptionRecord?.height_cm ?? appointment.patient.height_cm;
  const weight = receptionRecord?.weight_kg ?? appointment.patient.weight_kg;
  const bmi = getBmi(String(height ?? ""), String(weight ?? ""));
  const pressure = receptionRecord?.systolic_blood_pressure && receptionRecord.diastolic_blood_pressure ? `${receptionRecord.systolic_blood_pressure}/${receptionRecord.diastolic_blood_pressure}` : "";
  const vitals = [
    { key: "temperature" as const, label: "Nhiệt độ", raw: receptionRecord?.temperature_c != null ? String(receptionRecord.temperature_c) : "", unit: "°C", icon: Thermometer },
    { key: "bloodPressure" as const, label: "Huyết áp", raw: pressure, unit: "mmHg", icon: Activity },
    { key: "heartRate" as const, label: "Nhịp tim", raw: receptionRecord?.heart_rate != null ? String(receptionRecord.heart_rate) : "", unit: "bpm", icon: HeartPulse },
    { key: "spo2" as const, label: "SpO₂", raw: receptionRecord?.spo2 != null ? String(receptionRecord.spo2) : "", unit: "%", icon: Activity },
    { key: "height" as const, label: "Chiều cao", raw: height != null ? String(height) : "", unit: "cm", icon: Ruler },
    { key: "weight" as const, label: "Cân nặng", raw: weight != null ? String(weight) : "", unit: "kg", icon: Weight },
  ];
  const measuredAt = receptionRecord?.created_at
    ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(receptionRecord.created_at))
    : null;

  return (
    <div className="space-y-6 p-5">
      <section>
        <SectionHeading index={1} title="Chỉ số sinh tồn" description={measuredAt ? `Đo lúc ${measuredAt} tại REC-101` : "Ghi nhận tại phòng tiếp nhận"} />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
          {vitals.map((vital) => <VitalField key={vital.key} label={vital.label} raw={vital.raw} unit={vital.unit} icon={vital.icon} flag={getVitalFlag(vital.key, vital.raw)} />)}
        </div>
        {bmi && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            BMI <span className="text-sm font-semibold tabular-nums text-foreground">{bmi.value}</span>
            <span className={cn("rounded-full px-2 py-0.5 font-semibold", bmi.normal ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{bmi.label}</span>
          </p>
        )}
      </section>

      <div className="h-px bg-border" />

      <section>
        <SectionHeading index={2} title="Thông tin từ tiếp nhận" description="Lý do khám và lưu ý của bộ phận tiếp nhận" />
        <div className={cn("grid gap-3", receptionNote && "xl:grid-cols-2")}>
          <ReadOnlyBlock label="Lý do đến khám" text={visitReason} empty="Chưa ghi nhận lý do đến khám." />
          {receptionNote && <ReadOnlyBlock label="Ghi chú tiếp nhận" text={receptionNote} />}
        </div>
      </section>

      <section className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-4">
        <SectionHeading index={3} title="Đánh giá ban đầu" description="Chẩn đoán sơ bộ và hướng xử trí tiếp theo" />
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="diagnosis">Chẩn đoán sơ bộ</Label><Textarea id="diagnosis" rows={3} value={preliminaryDiagnosis} onChange={(event) => onPreliminaryDiagnosisChange(event.target.value)} placeholder="Ví dụ: Viêm đường hô hấp trên" className="min-h-20 resize-none rounded-xl bg-background p-3" /></div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2"><Label htmlFor="recommendation">Hướng đánh giá tiếp theo</Label><button type="button" onClick={onGoToOrders} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Chỉ định cận lâm sàng <ArrowRight className="size-3.5" /></button></div>
            <Textarea id="recommendation" rows={3} value={nextEvaluation} onChange={(event) => onNextEvaluationChange(event.target.value)} placeholder="Theo dõi, chỉ định xét nghiệm hoặc chẩn đoán..." className="min-h-20 resize-none rounded-xl bg-background p-3" />
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ index, title, description }: { index: number; title: string; description: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[0.7rem] font-bold text-primary">{index}</span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <span className="hidden h-4 w-px bg-border sm:block" />
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function ReadOnlyBlock({ label, text, empty }: { label: string; text?: string | null; empty?: string }) {
  return (
    <div className="rounded-2xl bg-muted/45 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {text?.trim() ? <Paragraphs text={text} className="mt-1.5 text-sm leading-6" /> : <p className="mt-1.5 text-sm text-muted-foreground">{empty}</p>}
    </div>
  );
}

function SavedAt({ value, label = "Đã lưu lúc" }: { value: string; label?: string }) {
  return <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Check className="size-3.5 text-emerald-600" /> {label} {new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value))}</p>;
}

/** Chuyển bệnh nhân lên OBS-403 (theo dõi tầng 4): nút nhỏ ở chân box, biểu mẫu trong dialog. */
function EscalateObservationDialog({ visitId, diagnosis, reception, onTransferred }: { visitId: string; diagnosis: string; reception: { heart_rate: number | null; systolic_blood_pressure: number | null; diastolic_blood_pressure: number | null; spo2: number | null; temperature_c: number | null } | null; onTransferred: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const defaultVitals = reception ? `Mạch ${reception.heart_rate ?? "—"} bpm · HA ${reception.systolic_blood_pressure ?? "—"}/${reception.diastolic_blood_pressure ?? "—"} mmHg · SpO₂ ${reception.spo2 ?? "—"}% · Nhiệt độ ${reception.temperature_c ?? "—"}°C` : "";
  const [form, setForm] = useState({ reason: "", preliminary_diagnosis: diagnosis, transport_condition: "", vital_signs: defaultVitals, handoff_note: "" });
  const mutation = useMutation({
    mutationFn: () => medicalVisitService.escalateToObservation(visitId, form),
    onSuccess: async (result) => { toast.success(result.message); setOpen(false); await onTransferred(); },
    onError: (error) => toast.error(getApiErrorMessage(error, "Không thể chuyển bệnh nhân lên OBS-403.")),
  });
  const canSubmit = form.reason.trim() && form.preliminary_diagnosis.trim() && form.transport_condition.trim() && form.vital_signs.trim();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setForm((current) => ({ ...current, preliminary_diagnosis: current.preliminary_diagnosis || diagnosis }));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100" />}>
        <Send className="size-3.5" /> Chuyển theo dõi OBS-403
      </DialogTrigger>
      <DialogContent className="scrollbar-thin max-h-[calc(100vh-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 pb-4 pt-6 pr-14">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <DialogTitle className="flex items-center gap-2 text-[0.95rem] font-semibold"><Send className="size-4 text-amber-700" /> Chuyển theo dõi tầng 4 (OBS-403)</DialogTitle>
          </div>
          <DialogDescription className="text-sm">Dùng khi tình trạng nặng, chưa cần ICU nhưng không phù hợp kết thúc lượt khám ngoại trú.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 px-6 py-5 sm:grid-cols-2">
          <label className="text-sm font-medium">Chẩn đoán *<Input value={form.preliminary_diagnosis} onChange={(e) => setForm({ ...form, preliminary_diagnosis: e.target.value })} className="mt-2" /></label>
          <label className="text-sm font-medium">Tình trạng vận chuyển *<Input value={form.transport_condition} onChange={(e) => setForm({ ...form, transport_condition: e.target.value })} placeholder="Ổn định, cần xe đẩy..." className="mt-2" /></label>
          <label className="text-sm font-medium sm:col-span-2">Lý do chuyển theo dõi *<Textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="mt-2" /></label>
          <label className="text-sm font-medium sm:col-span-2">Sinh hiệu trước chuyển *<Textarea rows={2} value={form.vital_signs} onChange={(e) => setForm({ ...form, vital_signs: e.target.value })} className="mt-2" /></label>
          <label className="text-sm font-medium sm:col-span-2">Ghi chú bàn giao<Textarea rows={3} value={form.handoff_note} onChange={(e) => setForm({ ...form, handoff_note: e.target.value })} className="mt-2" /></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-6 py-4">
          <p className="text-xs text-muted-foreground">Các mục có dấu * là bắt buộc.</p>
          <Button type="button" disabled={mutation.isPending || !canSubmit} onClick={() => mutation.mutate()} className="h-10 rounded-full bg-amber-700 px-5 hover:bg-amber-800">{mutation.isPending ? <LoaderCircle className="animate-spin" /> : <Send />} Xác nhận chuyển OBS-403</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConclusionPanel({ visitId, steps, preliminaryDiagnosis, values, onChange, onGoToOrders }: {
  visitId: string;
  steps: NonNullable<ReceptionQueueAppointment["medical_visits"][number]["steps"]>;
  preliminaryDiagnosis: string;
  values: { finalDiagnosis: string; treatmentDirection: string; conclusion: string; doctorAdvice: string };
  onChange: {
    setFinalDiagnosis: (value: string) => void;
    setTreatmentDirection: (value: string) => void;
    setConclusion: (value: string) => void;
    setDoctorAdvice: (value: string) => void;
  };
  onGoToOrders: () => void;
}) {
  const orders = getVisitOrders(steps);
  const pendingCount = orders.filter((order) => order.status !== "COMPLETED").length;
  return (
    <div className="space-y-5 p-5">
      <section>
        <SectionHeading index={1} title="Kết quả cận lâm sàng" description={orders.length > 0 ? `${orders.length - pendingCount}/${orders.length} chỉ định đã có kết quả` : "Kết quả từ các phòng chức năng đã chỉ định"} />
        {pendingCount > 0 && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
            <Hourglass className="mt-0.5 size-4 shrink-0" />
            <p>Còn <span className="font-semibold">{pendingCount}</span> chỉ định chưa có kết quả. Nên chờ đủ kết quả trước khi đưa ra kết luận cuối cùng.</p>
          </div>
        )}
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-5 text-center">
            <FileCheck2 className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Lượt khám không có chỉ định cận lâm sàng</p>
            <button type="button" onClick={onGoToOrders} className="mt-1 text-xs font-medium text-primary hover:underline">Thêm chỉ định →</button>
          </div>
        ) : (
          <OrderResultList visitId={visitId} steps={steps} />
        )}
      </section>

      <div className="h-px bg-border" />

      <section className="space-y-4">
        <SectionHeading index={2} title="Kết luận của bác sĩ" description="Chẩn đoán cuối cùng, hướng điều trị và lời dặn cho bệnh nhân" />
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="final-diagnosis">Chẩn đoán cuối cùng</Label>
              {!values.finalDiagnosis.trim() && preliminaryDiagnosis.trim() && (
                <button type="button" onClick={() => onChange.setFinalDiagnosis(preliminaryDiagnosis.trim())} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><Copy className="size-3.5" /> Dùng chẩn đoán sơ bộ</button>
              )}
            </div>
            <Textarea id="final-diagnosis" rows={3} value={values.finalDiagnosis} onChange={(event) => onChange.setFinalDiagnosis(event.target.value)} placeholder="Nhập chẩn đoán sau khi tổng hợp kết quả..." className="min-h-20 resize-none rounded-xl p-3" />
          </div>
          <div className="space-y-2"><Label htmlFor="treatment-direction">Hướng điều trị</Label><Textarea id="treatment-direction" rows={3} value={values.treatmentDirection} onChange={(event) => onChange.setTreatmentDirection(event.target.value)} placeholder="Điều trị ngoại trú, theo dõi hoặc chuyển tuyến..." className="min-h-20 resize-none rounded-xl p-3" /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="final-conclusion">Kết luận</Label><Textarea id="final-conclusion" rows={4} value={values.conclusion} onChange={(event) => onChange.setConclusion(event.target.value)} placeholder="Nhập kết luận cuối cùng của lượt khám..." className="min-h-24 resize-none rounded-xl p-3" /></div>
        <div className="space-y-2"><Label htmlFor="doctor-advice">Lời dặn và tái khám</Label><Textarea id="doctor-advice" rows={4} value={values.doctorAdvice} onChange={(event) => onChange.setDoctorAdvice(event.target.value)} placeholder="Nhập lời dặn, dấu hiệu cần theo dõi và thời gian tái khám..." className="min-h-24 resize-none rounded-xl p-3" /></div>
      </section>
    </div>
  );
}

function VitalField({ label, raw, unit, icon: Icon, flag }: { label: string; raw: string; unit: string; icon: typeof Activity; flag: "LOW" | "NORMAL" | "HIGH" | null }) {
  return (
    <div className={cn("rounded-2xl border border-transparent bg-muted/60 p-3", flag && flag !== "NORMAL" && "border-[var(--brand-coral)]/40 bg-card")}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Icon className="size-3.5 text-primary" /> {label}</span>
        {flag && flag !== "NORMAL" && <span className={cn("rounded-full px-1.5 py-px text-[0.65rem] font-semibold", flagStyle[flag].className)}>{flagStyle[flag].label}</span>}
      </div>
      <div className="mt-2 flex items-end gap-1">
        {raw ? <><p className="text-lg font-semibold tabular-nums">{raw}</p><span className="pb-0.5 text-xs text-muted-foreground">{unit}</span></> : <p className="text-sm text-muted-foreground">Chưa đo</p>}
      </div>
    </div>
  );
}

function PrescriptionPanel({ medicines, isLoading, items, note, onNoteChange, onItemsChange }: {
  medicines: AvailableMedicine[];
  isLoading: boolean;
  items: PrescriptionDraftItem[];
  note: string;
  onNoteChange: (value: string) => void;
  onItemsChange: (items: PrescriptionDraftItem[]) => void;
}) {
  const [medicineDialogOpen, setMedicineDialogOpen] = useState(false);
  const [medicineSearch, setMedicineSearch] = useState("");
  const [draftItems, setDraftItems] = useState<PrescriptionDraftItem[]>(items);
  const [draftNote, setDraftNote] = useState(note);
  const normalizedSearch = medicineSearch.trim().toLocaleLowerCase("vi");
  const suggestedMedicines = normalizedSearch ? medicines.filter((medicine) =>
    medicine.name.toLocaleLowerCase("vi").includes(normalizedSearch)
    || medicine.medicine_code.toLocaleLowerCase("vi").includes(normalizedSearch)).slice(0, 8) : [];

  function openPrescriptionDialog() {
    setDraftItems(items.map((item) => ({ ...item })));
    setDraftNote(note);
    setMedicineSearch("");
    setMedicineDialogOpen(true);
  }

  function addItem(medicine: AvailableMedicine) {
    if (draftItems.some((item) => item.medicine_id === medicine.id)) {
      toast.info("Thuốc này đã có trong đơn.");
      return;
    }
    setDraftItems((current) => [...current, { key: crypto.randomUUID(), medicine_id: medicine.id, dosage: "", quantity: "1", usage: "" }]);
    setMedicineSearch("");
  }

  function updateItem(key: string, patch: Partial<PrescriptionDraftItem>) {
    setDraftItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
  }

  const draftOverStock = draftItems.some((item) => getItemIssues(item, medicines).overStock);

  function confirmPrescriptionDraft() {
    if (draftOverStock) {
      toast.error("Có thuốc vượt số lượng tồn kho. Vui lòng chỉnh lại số lượng.");
      return;
    }
    onItemsChange(draftItems);
    onNoteChange(draftNote);
    setMedicineDialogOpen(false);
    setMedicineSearch("");
    toast.success("Đã cập nhật đơn thuốc (chưa gửi).", { description: "Bấm “Hoàn tất khám” ở cuối phiếu để gửi đơn sang nhà thuốc." });
  }

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="[&>div]:mb-0"><SectionHeading index={1} title="Thuốc được kê" description={items.length > 0 ? `${items.length} thuốc trong đơn` : "Kê đơn trong cửa sổ riêng"} /></div><Hint content="Mở cửa sổ để tìm thuốc và hoàn thiện đơn thuốc."><Button type="button" variant="outline" disabled={isLoading} className="rounded-full" onClick={openPrescriptionDialog}><Plus /> {items.length > 0 ? "Chỉnh sửa đơn thuốc" : "Thêm thuốc"}</Button></Hint></div>
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Tên thuốc</th><th className="px-3 py-3 font-medium">Liều dùng</th><th className="px-3 py-3 font-medium">Số lượng</th><th className="px-3 py-3 font-medium">Cách dùng</th><th className="w-12" /></tr></thead>
          <tbody className="divide-y">{items.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">Chưa có thuốc trong đơn. Bấm “Thêm thuốc” để bắt đầu kê đơn.</td></tr> : items.map((item) => <PrescriptionSummaryRow key={item.key} item={item} medicines={medicines} />)}</tbody>
        </table>
      </div>
      {note && <div className="rounded-2xl bg-muted/55 p-4"><p className="text-xs font-medium text-muted-foreground">Lời dặn dùng thuốc</p><p className="mt-2 whitespace-pre-wrap text-sm">{note}</p></div>}
      <Dialog open={medicineDialogOpen} onOpenChange={(open) => { setMedicineDialogOpen(open); if (!open) setMedicineSearch(""); }}>
        <DialogContent className="h-[min(86vh,52rem)] w-[min(94vw,70rem)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-5xl">
          <DialogHeader className="border-b bg-background px-7 pb-4 pt-6 pr-14"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><DialogTitle className="flex items-center gap-2 text-[0.95rem] font-semibold"><Pill className="size-4 text-primary" /> Kê đơn thuốc</DialogTitle><span className="hidden h-4 w-px bg-border sm:block" /><DialogDescription className="text-sm">Tìm thuốc, nhập liều dùng, số lượng, cách dùng và lời dặn.</DialogDescription></div></DialogHeader>
          <div className="min-h-0 overflow-y-auto px-7 py-6 scrollbar-hidden">
            <div className="relative"><Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-primary" /><Input autoFocus value={medicineSearch} onChange={(event) => setMedicineSearch(event.target.value)} placeholder="Gõ tên hoặc mã thuốc để tìm..." className="h-13 rounded-2xl border-primary/20 bg-muted/35 pl-12 text-base shadow-none" /></div>
            {normalizedSearch && <div className="relative z-10 mt-2 overflow-hidden rounded-2xl border bg-popover shadow-lg">
              {isLoading ? <p className="p-5 text-center text-sm text-muted-foreground">Đang tìm thuốc...</p> : suggestedMedicines.length === 0 ? <p className="p-5 text-center text-sm text-muted-foreground">Không tìm thấy thuốc phù hợp.</p> : suggestedMedicines.map((medicine) => {
                const added = draftItems.some((item) => item.medicine_id === medicine.id);
                return <button key={medicine.id} type="button" disabled={added} onClick={() => addItem(medicine)} className="flex w-full items-center justify-between gap-4 border-b px-5 py-3.5 text-left last:border-b-0 hover:bg-primary/[0.05] disabled:opacity-50"><span><span className="block font-semibold">{medicine.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{medicine.medicine_code} · còn {medicine.stock_quantity} {medicine.unit}</span></span><span className="text-xs font-semibold text-primary">{added ? "Đã thêm" : "Thêm vào đơn"}</span></button>;
              })}
            </div>}

            <div className="mt-6 flex items-center justify-between"><div><h3 className="font-semibold">Thuốc trong đơn</h3><p className="mt-1 text-xs text-muted-foreground">Nhập đầy đủ hướng dẫn cho từng thuốc đã chọn.</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{draftItems.length} thuốc</span></div>
            <div className="mt-3 overflow-x-auto rounded-2xl border"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Tên thuốc</th><th className="px-3 py-3 font-medium">Liều dùng</th><th className="px-3 py-3 font-medium">Số lượng</th><th className="px-3 py-3 font-medium">Cách dùng</th><th className="w-12" /></tr></thead><tbody className="divide-y">{draftItems.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Gõ tên thuốc ở thanh tìm kiếm để thêm vào đơn.</td></tr> : draftItems.map((item) => <MedicineRow key={item.key} item={item} medicines={medicines} onChange={(patch) => updateItem(item.key, patch)} onRemove={() => setDraftItems((current) => current.filter((entry) => entry.key !== item.key))} />)}</tbody></table></div>
            <div className="mt-5 space-y-2"><Label htmlFor="dialog-prescription-note">Lời dặn dùng thuốc</Label><Textarea id="dialog-prescription-note" rows={4} value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder="Nhập lưu ý, thời gian tái khám hoặc dấu hiệu cần quay lại bệnh viện..." className="min-h-24 resize-none rounded-xl p-3" /></div>
            </div>
          <DialogFooter className="m-0 rounded-none border-t bg-muted/30 px-7 py-5 sm:justify-between"><p className="self-center text-sm text-muted-foreground">Đơn thuốc hiện có <strong className="text-foreground">{draftItems.length}</strong> thuốc</p><div className="flex gap-2"><Button type="button" variant="outline" className="h-10 rounded-full px-6" onClick={() => setMedicineDialogOpen(false)}>Hủy</Button><Button type="button" disabled={draftOverStock} className="h-10 rounded-full px-6" onClick={confirmPrescriptionDraft}><Check /> Cập nhật đơn thuốc</Button></div></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Vấn đề của một dòng thuốc: vượt tồn kho (chặn), thiếu liều dùng / cách dùng (chỉ nhắc). */
function getItemIssues(item: PrescriptionDraftItem, medicines: AvailableMedicine[]) {
  const medicine = medicines.find((option) => option.id === item.medicine_id);
  const quantity = Number(item.quantity) || 0;
  return {
    medicine,
    overStock: Boolean(medicine && quantity > medicine.stock_quantity),
    missingDosage: !item.dosage.trim(),
    missingUsage: !item.usage.trim(),
  };
}

function PrescriptionSummaryRow({ item, medicines }: { item: PrescriptionDraftItem; medicines: AvailableMedicine[] }) {
  const { medicine, overStock } = getItemIssues(item, medicines);
  return (
    <tr className={cn(overStock && "bg-destructive/[0.04]")}>
      <td className="px-4 py-3">
        <p className="min-w-48 font-medium">{medicine?.name ?? "Thuốc không còn khả dụng"}</p>
        {medicine && <p className="mt-1 text-xs text-muted-foreground">{medicine.medicine_code} · còn {medicine.stock_quantity} {medicine.unit}</p>}
      </td>
      <td className="px-3 py-3">{item.dosage || <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Thiếu liều dùng</span>}</td>
      <td className="px-3 py-3">
        <span className={cn(overStock && "font-semibold text-destructive")}>{item.quantity} {medicine?.unit}</span>
        {overStock && <p className="text-xs text-destructive">Vượt tồn kho</p>}
      </td>
      <td className="px-3 py-3">{item.usage || <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Thiếu cách dùng</span>}</td>
      <td />
    </tr>
  );
}

function MedicineRow({ item, medicines, onChange, onRemove }: { item: PrescriptionDraftItem; medicines: AvailableMedicine[]; onChange: (patch: Partial<PrescriptionDraftItem>) => void; onRemove: () => void }) {
  const { medicine, overStock, missingDosage, missingUsage } = getItemIssues(item, medicines);
  return (
    <tr className={cn(overStock && "bg-destructive/[0.04]")}>
      <td className="px-4 py-3">
        <p className="min-w-48 font-medium">{medicine?.name ?? "Thuốc không còn khả dụng"}</p>
        {medicine && <p className={cn("mt-1 text-xs", overStock ? "font-medium text-destructive" : "text-muted-foreground")}>{medicine.medicine_code} · còn {medicine.stock_quantity} {medicine.unit}</p>}
      </td>
      <td className="px-3 py-3"><Input value={item.dosage} onChange={(event) => onChange({ dosage: event.target.value })} placeholder="1 viên x 2 lần/ngày" className={cn("h-9 min-w-40 rounded-lg", missingDosage && "border-amber-300 bg-amber-50/50")} /></td>
      <td className="px-3 py-3">
        <Input type="number" min="1" max={medicine?.stock_quantity} value={item.quantity} onChange={(event) => onChange({ quantity: event.target.value })} aria-invalid={overStock} className={cn("h-9 w-20 rounded-lg", overStock && "border-destructive ring-3 ring-destructive/15")} />
        {overStock && <p className="mt-1 text-[0.7rem] text-destructive">Vượt tồn kho</p>}
      </td>
      <td className="px-3 py-3"><Input value={item.usage} onChange={(event) => onChange({ usage: event.target.value })} placeholder="Sau ăn" className={cn("h-9 min-w-28 rounded-lg", missingUsage && "border-amber-300 bg-amber-50/50")} /></td>
      <td className="pr-3"><Hint content="Xóa thuốc khỏi đơn."><Button type="button" variant="ghost" size="icon-sm" aria-label="Xóa thuốc" className="text-destructive" onClick={onRemove}><Trash2 /></Button></Hint></td>
    </tr>
  );
}

/** 2. Xác nhận hoàn tất lượt khám: tóm tắt + cảnh báo trước khi gửi đơn / kết thúc khám. */
function CompleteVisitDialog({ open, onOpenChange, finalDiagnosis, conclusionDirty, onSaveConclusion, isSavingConclusion, pendingOrderCount, items, medicines, isSubmitting, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finalDiagnosis: string;
  conclusionDirty: boolean;
  onSaveConclusion: () => void;
  isSavingConclusion: boolean;
  pendingOrderCount: number;
  items: PrescriptionDraftItem[];
  medicines: AvailableMedicine[];
  isSubmitting: boolean;
  onConfirm: () => void;
}) {
  const hasMedicines = items.length > 0;
  const incompleteItems = items.filter((item) => {
    const issues = getItemIssues(item, medicines);
    return issues.missingDosage || issues.missingUsage;
  }).length;
  const warnings = [
    pendingOrderCount > 0 && { tone: "danger" as const, text: `Còn ${pendingOrderCount} chỉ định chưa có kết quả — sẽ bị HỦY khi hoàn tất.` },
    !finalDiagnosis.trim() && { tone: "warning" as const, text: "Chưa có chẩn đoán cuối cùng." },
    incompleteItems > 0 && { tone: "warning" as const, text: `${incompleteItems} thuốc chưa ghi đủ liều dùng / cách dùng.` },
  ].filter(Boolean) as Array<{ tone: "danger" | "warning"; text: string }>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 pb-4 pt-6 pr-14">
          <DialogTitle className="flex items-center gap-2 text-[0.95rem] font-semibold"><FileCheck2 className="size-4 text-primary" /> Hoàn tất lượt khám</DialogTitle>
          <DialogDescription className="text-sm">Kiểm tra lại trước khi kết thúc phần khám tại phòng.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 py-5">
          <dl className="space-y-3 rounded-2xl bg-muted/50 p-4 text-sm">
            <div><dt className="text-xs text-muted-foreground">Chẩn đoán cuối cùng</dt><dd className="mt-0.5 font-medium">{finalDiagnosis.trim() || <span className="text-muted-foreground">Chưa có</span>}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Đơn thuốc</dt><dd className="mt-0.5 font-medium">{hasMedicines ? `${items.length} thuốc` : "Không kê thuốc"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Bệnh nhân đi tiếp</dt><dd className="mt-0.5 font-medium">{hasMedicines ? "Nhà thuốc PHM-105 nhận thuốc" : "Kết thúc lượt khám, bệnh nhân ra về"}</dd></div>
          </dl>

          {conclusionDirty && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
              <span>Kết luận có thay đổi chưa lưu.</span>
              <Button type="button" size="sm" variant="outline" disabled={isSavingConclusion} onClick={onSaveConclusion} className="h-8 rounded-full border-amber-300 bg-white px-3 text-xs">{isSavingConclusion ? <LoaderCircle className="animate-spin" /> : <Save />} Lưu kết luận</Button>
            </div>
          )}
          {warnings.map((warning) => (
            <p key={warning.text} className={cn("flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm", warning.tone === "danger" ? "border border-destructive/25 bg-destructive/[0.05] text-destructive" : "border border-amber-300/60 bg-amber-50 text-amber-900")}>
              <Hourglass className="mt-0.5 size-4 shrink-0" /> {warning.text}
            </p>
          ))}
        </div>
        <DialogFooter className="m-0 rounded-none border-t bg-muted/40 px-6 py-4">
          <Button type="button" variant="outline" className="h-10 rounded-full px-5" onClick={() => onOpenChange(false)}>Quay lại</Button>
          <Button type="button" disabled={isSubmitting} onClick={onConfirm} className={cn("h-10 rounded-full px-5", pendingOrderCount > 0 && "bg-destructive hover:bg-destructive/90")}>
            {isSubmitting ? <LoaderCircle className="animate-spin" /> : <Check />} {hasMedicines ? "Hoàn tất & chuyển nhà thuốc" : "Hoàn tất khám"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Hint({ content, children }: { content: string; children: ReactNode }) {
  return <span className="group/hint relative inline-flex"><span className="inline-flex">{children}</span><span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-64 -translate-x-1/2 translate-y-1 rounded-lg bg-foreground px-3 py-2 text-center text-xs font-medium leading-4 text-background opacity-0 shadow-xl transition group-hover/hint:translate-y-0 group-hover/hint:opacity-100 group-focus-within/hint:translate-y-0 group-focus-within/hint:opacity-100">{content}<span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-foreground" /></span></span>;
}

function buildPrescriptionPayload(items: PrescriptionDraftItem[], note: string): SavePrescriptionPayload {
  return {
    note: note.trim() || null,
    items: items.map((item) => ({
      medicine_id: item.medicine_id,
      dosage: item.dosage.trim() || null,
      quantity: Math.max(1, Number(item.quantity) || 1),
      usage: item.usage.trim() || null,
    })),
  };
}

function getFooterAction(tab: WorkspaceTab, selectedOrderCount: number, prescriptionCount = 0) {
  if (tab === "ORDERS") return {
    label: "Thêm chỉ định",
    description: selectedOrderCount > 0 ? `${selectedOrderCount} chỉ định đang chờ kết quả.` : "Chọn phòng chức năng cần thực hiện cho bệnh nhân.",
    tooltip: "Mở danh sách phòng chức năng để chỉ định.",
    notification: "",
    icon: ClipboardPlus,
  };
  if (tab === "CONCLUSION") return {
    label: "Lưu kết luận",
    description: "Lưu chẩn đoán cuối cùng, hướng điều trị và lời dặn.",
    tooltip: "Ghi nhận kết luận cuối cùng của bác sĩ cho lượt khám.",
    notification: "Chức năng lưu kết luận sẽ được kết nối API ở bước tiếp theo.",
    icon: FileCheck2,
  };
  if (tab === "PRESCRIPTION") return {
    label: prescriptionCount > 0 ? "Hoàn tất khám & chuyển nhà thuốc" : "Hoàn tất khám",
    description: prescriptionCount > 0 ? "Kiểm tra thuốc, liều dùng và lời dặn trước khi hoàn tất." : "Không kê thuốc: hoàn tất sẽ kết thúc lượt khám.",
    tooltip: "Xem tóm tắt và xác nhận kết thúc phần khám tại phòng.",
    notification: "",
    icon: FileCheck2,
  };
  return {
    label: "Lưu thông tin khám",
    description: "Lưu nội dung khám và đánh giá ban đầu của bác sĩ.",
    tooltip: "Ghi nhận thông tin khám ban đầu cho lượt khám hiện tại.",
    notification: "Chức năng lưu thông tin khám sẽ được kết nối API ở bước tiếp theo.",
    icon: Save,
  };
}
