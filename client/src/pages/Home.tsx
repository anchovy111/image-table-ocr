import { useState, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ImageUploader } from "@/components/ImageUploader";
import { EditableTable } from "@/components/EditableTable";
import { ExportMenu } from "@/components/ExportMenu";
import { RecognitionStatus } from "@/components/RecognitionStatus";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Scan,
  LogIn,
  Sparkles,
  TableProperties,
  Edit3,
  Download,
  History,
  ArrowRight,
  Save,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

type Step = "idle" | "uploading" | "recognizing" | "done" | "error";

interface TableData {
  headers: string[];
  rows: string[][];
}

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const [step, setStep] = useState<Step>("idle");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recordId, setRecordId] = useState<number | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const uploadMutation = trpc.ocr.uploadImage.useMutation();
  const recognizeMutation = trpc.ocr.recognize.useMutation();
  const updateTableMutation = trpc.ocr.updateTableData.useMutation();

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setStep("idle");
    setTableData(null);
    setRecordId(null);
    setHasUnsavedChanges(false);
  }, []);

  const handleRecognize = async () => {
    if (!selectedFile) return;

    try {
      // Step 1: Upload
      setStep("uploading");
      setErrorMessage(undefined);

      const base64Data = await fileToBase64(selectedFile);
      const uploadResult = await uploadMutation.mutateAsync({
        filename: selectedFile.name,
        mimeType: selectedFile.type || "image/jpeg",
        base64Data,
      });

      setRecordId(uploadResult.recordId);

      // Step 2: Recognize
      setStep("recognizing");
      const result = await recognizeMutation.mutateAsync({
        recordId: uploadResult.recordId,
      });

      // 处理二维数组格式：[headers, ...rows]
      const tableArray = result.tableData;
      if (Array.isArray(tableArray) && tableArray.length > 0) {
        const headers = tableArray[0] as string[];
        const rows = tableArray.slice(1) as string[][];
        setTableData({ headers, rows });
      } else {
        throw new Error("表格数据格式错误");
      }
      setStep("done");
      toast.success("表格识别成功！");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "识别失败，请重试";
      setErrorMessage(msg);
      setStep("error");
      toast.error(msg);
    }
  };

  const handleTableChange = (newData: TableData) => {
    setTableData(newData);
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!recordId || !tableData) return;
    setIsSaving(true);
    try {
      await updateTableMutation.mutateAsync({
        recordId,
        tableData,
      });
      setHasUnsavedChanges(false);
      toast.success("已保存修改");
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setStep("idle");
    setSelectedFile(null);
    setTableData(null);
    setRecordId(null);
    setHasUnsavedChanges(false);
    setErrorMessage(undefined);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">加载中…</p>
        </div>
      </div>
    );
  }

  // Landing page for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-4rem)]">
        {/* Hero section */}
        <section className="relative overflow-hidden py-20 md:py-28">
          <div
            className="absolute inset-0 -z-10"
            style={{ background: "var(--gradient-hero)" }}
          />
          <div className="container text-center space-y-8 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              AI 驱动的表格识别工具
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight">
              一键识别图片中的
              <br />
              <span className="text-primary">表格数据</span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg text-muted-foreground leading-relaxed">
              上传包含表格的图片或 PDF，AI 自动提取结构化数据，支持在线编辑与导出为 Excel / CSV 文件。
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => (window.location.href = getLoginUrl())}
                className="gap-2 px-8 h-12 text-base shadow-md hover:shadow-lg transition-shadow"
              >
                <LogIn className="h-5 w-5" />
                立即登录开始使用
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 container">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Scan,
                title: "智能识别",
                desc: "基于先进视觉 AI，精准提取图片中的表格结构与内容",
                color: "text-violet-600",
                bg: "bg-violet-50",
              },
              {
                icon: Edit3,
                title: "在线编辑",
                desc: "双击单元格即可直接修改识别结果，无需额外工具",
                color: "text-blue-600",
                bg: "bg-blue-50",
              },
              {
                icon: Download,
                title: "灵活导出",
                desc: "支持导出为 Excel (.xlsx) 和 CSV 两种格式，随时使用",
                color: "text-emerald-600",
                bg: "bg-emerald-50",
              },
              {
                icon: History,
                title: "历史记录",
                desc: "自动保存所有识别记录，随时查看与重新导出历史数据",
                color: "text-amber-600",
                bg: "bg-amber-50",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="card-elegant p-6 space-y-3 animate-fade-in-up"
              >
                <div className={cn("inline-flex p-2.5 rounded-xl", feature.bg)}>
                  <feature.icon className={cn("h-5 w-5", feature.color)} />
                </div>
                <h3 className="font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // Main app for authenticated users
  return (
    <div className="container py-8 space-y-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">表格识别</h1>
          <p className="text-sm text-muted-foreground mt-1">
            上传图片，AI 自动提取表格内容
          </p>
        </div>
        <Link href="/history">
          <Button variant="outline" size="sm" className="gap-2">
            <History className="h-4 w-4" />
            历史记录
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Upload panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="card-elegant border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TableProperties className="h-4 w-4 text-primary" />
                上传图片
              </CardTitle>
              <CardDescription className="text-xs">
                支持 JPG、PNG、GIF、PDF 格式
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImageUploader
                onFileSelect={handleFileSelect}
                disabled={step === "uploading" || step === "recognizing"}
              />

              {selectedFile && step === "idle" && (
                <Button
                  className="w-full gap-2 h-11"
                  onClick={handleRecognize}
                >
                  <Scan className="h-4 w-4" />
                  开始识别
                </Button>
              )}

              {step === "error" && (
                <div className="space-y-2">
                  <Button
                    className="w-full gap-2"
                    onClick={handleRecognize}
                    variant="outline"
                  >
                    重新识别
                  </Button>
                  <Button
                    className="w-full gap-2"
                    onClick={handleReset}
                    variant="ghost"
                    size="sm"
                  >
                    重新上传
                  </Button>
                </div>
              )}

              {step === "done" && (
                <Button
                  className="w-full gap-2"
                  onClick={handleReset}
                  variant="outline"
                  size="sm"
                >
                  识别新图片
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Result panel */}
        <div className="lg:col-span-3 space-y-4">
          {step === "idle" && !tableData && (
            <Card className="card-elegant border-0 border-dashed">
              <CardContent className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
                  <Sparkles className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="text-base font-medium text-muted-foreground/70">
                    识别结果将在此处显示
                  </p>
                  <p className="text-sm text-muted-foreground/50 mt-1">
                    上传图片后点击「开始识别」
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {(step === "uploading" || step === "recognizing" || step === "error") && (
            <Card className="card-elegant border-0">
              <CardContent className="flex items-center justify-center min-h-[300px]">
                <RecognitionStatus step={step} errorMessage={errorMessage} />
              </CardContent>
            </Card>
          )}

          {step === "done" && tableData && (
            <Card className="card-elegant border-0 animate-fade-in-up">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TableProperties className="h-4 w-4 text-emerald-600" />
                      识别结果
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {tableData.headers.length} 列 · {tableData.rows.length} 行 · 点击单元格可编辑
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasUnsavedChanges && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="gap-1.5 text-xs h-8"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {isSaving ? "保存中…" : "保存修改"}
                      </Button>
                    )}
                    <ExportMenu
                      tableData={tableData}
                      filename={selectedFile?.name?.replace(/\.[^/.]+$/, "") || "表格数据"}
                      size="sm"
                    />
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-4 p-0">
                <EditableTable
                  data={tableData}
                  onChange={handleTableChange}
                  className="rounded-none rounded-b-xl border-0"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
