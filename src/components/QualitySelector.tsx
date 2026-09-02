import { VideoQuality } from "@/types/tiktok";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface QualitySelectorProps {
  value: VideoQuality | "audio";
  onChange: (value: VideoQuality | "audio") => void;
  options: { label: string; value: VideoQuality | "audio" }[];
  className?: string;
  disabled?: boolean;
}

export function QualitySelector({
  value,
  onChange,
  options,
  className,
  disabled,
}: QualitySelectorProps) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as VideoQuality | "audio")}
        disabled={disabled}
        className={cn(
          "appearance-none w-full bg-slate-900/50 border border-slate-800 text-slate-300",
          "rounded-md py-2 pl-3 pr-8 text-sm outline-none transition-all",
          "focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 hover:bg-slate-800/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-300">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
    </div>
  );
}
