import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { EditableTable } from "@/components/EditableTable";
import { ExportMenu } from "@/components/ExportMenu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  History,
  Eye,
  Trash2,
  LogIn,
  TableProperties,
  Calendar,
  FileImage,
  ImageIcon,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface TableData {
  headers: string[];
  rows: string[][];
}

interface OcrRecord {
  id: number;
  title: string;
  imageUrl: string;
  originalFilename: string | null;
  tableData: TableData;
  status: "pending" | "processing" | "done" | "error";
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const statusConfig = {
  pending: { label: "等待中", className: "status-pending", icon: Clock },
  processing: { label: "识别中", className: "status-processing", icon: Loader2 },
  done: { label: "已完成", className: "status-done", icon: TableProperties },
  error: { label: "识别失败", className: "status-error", icon: AlertCircle },
};

export default function HistoryPage() {
  const { isAuthenticated, loading } = useAuth();
  const [viewRecord, setViewRecord] = useState<OcrRecord | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: records, isLoading, refetch } = trpc.ocr.listRecords.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const deleteMutation = trpc.ocr.deleteRecord.useMutation({
    onSuccess: () => {
      toast.success("记录已删除");
      refetch();
      setDeleteId(null);
    },
    onError: () => toast.error("删除失败，请重试"),
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container py-20 text-center space-y-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mx-auto">
          <History className="h-7 w-7 text-muted-foreground/40" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">需要登录</h2>
          <p className="text-muted-foreground mt-2">登录后可查看您的识别历史记录</p>
        </div>
        <Button onClick={() => (window.location.href = getLoginUrl())} className="gap-2">
          <LogIn className="h-4 w-4" />
          立即登录
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            历史记录
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {records ? `共 ${records.length} 条识别记录` : "加载中…"}
          </p>
        </div>
        <Link href="/">
          <Button size="sm" className="gap-2">
            <TableProperties className="h-4 w-4" />
            新建识别
          </Button>
        </Link>
      </div>

      {/* Records list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="card-elegant border-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-14 w-14 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !records || records.length === 0 ? (
        <Card className="card-elegant border-0 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
              <FileImage className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-base font-medium text-muted-foreground/70">暂无识别记录</p>
              <p className="text-sm text-muted-foreground/50 mt-1">
                上传图片开始识别后，记录将自动保存在这里
              </p>
            </div>
            <Link href="/">
              <Button size="sm" className="gap-2 mt-2">
                <TableProperties className="h-4 w-4" />
                开始识别
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {records.map((record) => {
            const status = statusConfig[record.status];
            const StatusIcon = status.icon;
            const hasData =
              record.status === "done" &&
              (record.tableData.headers.length > 0 || record.tableData.rows.length > 0);

            return (
              <Card
                key={record.id}
                className="card-elegant border-0 animate-fade-in-up"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Image thumbnail */}
                    <div className="h-14 w-14 rounded-lg overflow-hidden bg-muted/40 flex-shrink-0 border border-border/40">
                      {record.imageUrl ? (
                        <img
                          src={record.imageUrl}
                          alt={record.title}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-foreground truncate max-w-[200px] sm:max-w-none">
                          {record.title}
                        </h3>
                        <Badge
                          variant="outline"
                          className={cn("text-xs px-2 py-0.5 border", status.className)}
                        >
                          <StatusIcon
                            className={cn(
                              "h-3 w-3 mr-1",
                              record.status === "processing" && "animate-spin"
                            )}
                          />
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(record.createdAt).toLocaleString("zh-CN", {
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {hasData && (
                          <span>
                            {record.tableData.headers.length} 列 · {record.tableData.rows.length} 行
                          </span>
                        )}
                        {record.originalFilename && (
                          <span className="truncate max-w-[120px] hidden sm:block">
                            {record.originalFilename}
                          </span>
                        )}
                      </div>
                      {record.status === "error" && record.errorMessage && (
                        <p className="text-xs text-destructive mt-1 truncate">
                          {record.errorMessage}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {hasData && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-8 text-xs"
                            onClick={() => setViewRecord(record as OcrRecord)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            查看
                          </Button>
                          <ExportMenu
                            tableData={record.tableData}
                            filename={record.title}
                            size="sm"
                            variant="outline"
                          />
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteId(record.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* View dialog */}
      <Dialog open={!!viewRecord} onOpenChange={(open) => !open && setViewRecord(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TableProperties className="h-5 w-5 text-primary" />
              {viewRecord?.title}
            </DialogTitle>
            <DialogDescription>
              {viewRecord && (
                <>
                  {viewRecord.tableData.headers.length} 列 · {viewRecord.tableData.rows.length} 行 ·{" "}
                  {new Date(viewRecord.createdAt).toLocaleString("zh-CN")}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <p className="text-xs text-muted-foreground">仅供查看，如需编辑请重新识别</p>
            {viewRecord && (
              <ExportMenu
                tableData={viewRecord.tableData}
                filename={viewRecord.title}
                size="sm"
              />
            )}
          </div>
          <div className="overflow-auto flex-1">
            {viewRecord && (
              <EditableTable data={viewRecord.tableData} readOnly className="border-border/40" />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除该识别记录，无法恢复。确定要继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ recordId: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
