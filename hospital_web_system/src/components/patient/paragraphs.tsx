import { cn } from "@/lib/utils";

/** Tách văn bản theo dòng thành từng đoạn và thụt lề dòng đầu tiên của mỗi đoạn. */
export function Paragraphs({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return (
    <div className={cn("space-y-1.5", className)}>
      {paragraphs.map((paragraph, index) => <p key={index} className="indent-5">{paragraph}</p>)}
    </div>
  );
}
