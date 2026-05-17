import { cn } from "@/lib/utils";
import { Check, Loader2, AlertCircle, Upload, Cpu, CheckCircle2 } from "lucide-react";

type Step = "idle" | "uploading" | "recognizing" | "done" | "error";

interface RecognitionStatusProps {
  step: Step;
  errorMessage?: string;
}

const steps = [
  { key: "uploading", label: "上传图片", icon: Upload },
  { key: "recognizing", label: "AI 识别", icon: Cpu },
  { key: "done", label: "识别完成", icon: CheckCircle2 },
];

export function RecognitionStatus({ step, errorMessage }: RecognitionStatusProps) {
  if (step === "idle") return null;

  const getStepState = (stepKey: string) => {
    const order = ["uploading", "recognizing", "done"];
    const currentIdx = order.indexOf(step === "error" ? "recognizing" : step);
    const stepIdx = order.indexOf(stepKey);

    if (step === "error" && stepKey === "recognizing") return "error";
    if (stepIdx < currentIdx) return "done";
    if (stepIdx === currentIdx) return step === "done" ? "done" : "active";
    return "pending";
  };

  return (
    <div className="space-y-4">
      {/* Step indicators */}
      <div className="flex items-center justify-center gap-0">
        {steps.map((s, idx) => {
          const state = getStepState(s.key);
          const Icon = s.icon;

          return (
            <div key={s.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-300",
                    state === "done" && "border-emerald-500 bg-emerald-500 text-white",
                    state === "active" && "border-primary bg-primary/10 text-primary",
                    state === "error" && "border-destructive bg-destructive/10 text-destructive",
                    state === "pending" && "border-border bg-muted/40 text-muted-foreground/40"
                  )}
                >
                  {state === "done" ? (
                    <Check className="h-4 w-4" />
                  ) : state === "active" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : state === "error" ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium whitespace-nowrap",
                    state === "done" && "text-emerald-600",
                    state === "active" && "text-primary",
                    state === "error" && "text-destructive",
                    state === "pending" && "text-muted-foreground/50"
                  )}
                >
                  {s.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-16 mx-2 mb-5 rounded-full transition-all duration-500",
                    getStepState(steps[idx + 1].key) !== "pending" || state === "done"
                      ? "bg-emerald-400"
                      : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Status message */}
      {step === "uploading" && (
        <p className="text-center text-sm text-muted-foreground animate-pulse">
          正在上传图片，请稍候…
        </p>
      )}
      {step === "recognizing" && (
        <p className="text-center text-sm text-muted-foreground animate-pulse">
          AI 正在分析图片中的表格内容，请稍候…
        </p>
      )}
      {step === "done" && (
        <p className="text-center text-sm text-emerald-600 font-medium">
          识别完成！请查看下方表格
        </p>
      )}
      {step === "error" && (
        <p className="text-center text-sm text-destructive">
          {errorMessage || "识别失败，请重试"}
        </p>
      )}
    </div>
  );
}
