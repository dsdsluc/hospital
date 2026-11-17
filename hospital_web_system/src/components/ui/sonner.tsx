"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/**
 * Toaster dùng chung cho toàn hệ thống (bệnh nhân, bác sĩ, ...).
 * Dùng chế độ `unstyled` để bỏ CSS mặc định của Sonner và style hoàn toàn
 * bằng token của site: nền xanh primary, chữ mảnh, font kế thừa từ trang.
 * Thông báo tự ẩn sau 3 giây.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      closeButton
      gap={10}
      className="toaster group"
      style={
        {
          fontFamily: "inherit",
          "--width": "380px",
        } as React.CSSProperties
      }
      icons={{
        success: <CircleCheckIcon className="size-[1.05rem]" />,
        info: <InfoIcon className="size-[1.05rem]" />,
        warning: <TriangleAlertIcon className="size-[1.05rem]" />,
        error: <OctagonXIcon className="size-[1.05rem]" />,
        loading: <Loader2Icon className="size-[1.05rem] animate-spin" />,
      }}
      duration={3000}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group/toast flex w-(--width) items-start gap-3 rounded-2xl bg-primary p-3.5 pr-10 text-primary-foreground shadow-xl shadow-primary/25 ring-1 ring-white/10",
          icon:
            "grid size-7 shrink-0 place-items-center rounded-full bg-white/15 text-white",
          content: "flex min-w-0 flex-1 flex-col gap-0.5 pt-[0.2rem]",
          title: "text-sm font-normal leading-5 text-white",
          description: "text-[0.8125rem] font-light leading-5 text-white/70",
          closeButton:
            "absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full text-white/60 transition hover:bg-white/15 hover:text-white [&_svg]:size-3.5",
          actionButton:
            "ml-2 h-7 shrink-0 self-center rounded-full bg-white px-3 text-xs font-medium text-primary transition hover:bg-white/90",
          cancelButton:
            "ml-2 h-7 shrink-0 self-center rounded-full bg-white/15 px-3 text-xs font-normal text-white transition hover:bg-white/25",
          success: "",
          info: "",
          warning: "[&_[data-icon]]:bg-amber-300/25 [&_[data-icon]]:text-amber-200",
          error: "[&_[data-icon]]:bg-[var(--brand-coral)] [&_[data-icon]]:text-white",
          loading: "",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
