/** URL quay lại an toàn từ `?back=` (chỉ nhận đường dẫn nội bộ trong /doctor). Dùng được ở cả server lẫn client. */
export function resolveBackHref(back: string | undefined, fallback = "/doctor/workspace?tab=queue") {
  return back && back.startsWith("/doctor") && !back.startsWith("//") ? back : fallback;
}
