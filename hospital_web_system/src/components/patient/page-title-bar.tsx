import type { ReactNode } from "react";

/**
 * Thanh tiêu đề nằm ngang dùng chung cho các trang bệnh nhân:
 * [tiêu đề] [nhãn] | [mô tả] ............ [hành động]
 */
export function PageTitleBar({
  title,
  badge,
  description,
  actions,
}: {
  title: ReactNode;
  badge?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="mb-10 flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-3.5 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between md:px-5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5">
        {title}
        {badge && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary">{badge}</span>}
        {description && (
          <>
            <span className="hidden h-6 w-px bg-border lg:block" />
            <p className="hidden text-sm text-muted-foreground lg:block">{description}</p>
          </>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </section>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-[0.95rem] font-semibold text-foreground">{children}</h1>;
}
