import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Eye, Download, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { exportToXLSX, exportToCSV, type TableData } from "@/lib/exportUtils";

type OcrRecord = {
  id: number;
  userId: number;
  title: string;
  imageUrl: string;
  imageKey: string;
  originalFilename: string | null;
  tableData: string;
  status: "pending" | "processing" | "done" | "error";
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const PAGE_SIZE = 20;

export default function HistoryPage() {
  const { isAuthenticated, loading } = useAuth();
  const [viewRecord, setViewRecord] = useState<OcrRecord | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // 直接使用 trpc 查询结果，不做本地累积
  const { data, isLoading, isFetching } = trpc.ocr.listRecordsPaginated.useQuery(
    { page: currentPage, pageSize: PAGE_SIZE },
    {
      enabled: isAuthenticated,
    }
  );

  const utils = trpc.useUtils();

  const deleteMutation = trpc.ocr.deleteRecord.useMutation({
    onSuccess: () => {
      toast.success("记录已删除");
      setDeleteId(null);
      // 使分页查询缓存失效，重新加载当前页
      utils.ocr.listRecordsPaginated.invalidate();
    },
    onError: () => toast.error("删除失败，请重试"),
  });

  const handleDelete = (id: number) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate({ recordId: deleteId });
    }
  };

  const handleExport = (record: OcrRecord, format: "xlsx" | "csv") => {
    try {
      const rows = JSON.parse(record.tableData);
      if (!Array.isArray(rows) || rows.length === 0) {
        toast.error("表格数据为空");
        return;
      }

      // 第一行作为表头，其余行作为数据
      const tableData: TableData = {
        headers: rows[0] || [],
        rows: rows.slice(1) || [],
      };
      const filename = record.title || "table";

      if (format === "xlsx") {
        exportToXLSX(tableData, filename);
      } else {
        exportToCSV(tableData, filename);
      }
      toast.success(`已导出为 ${format.toUpperCase()}`);
    } catch (error) {
      toast.error("导出失败，请重试");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleLoginClick = () => {
    window.location.href = getLoginUrl();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">请登录查看历史记录</h1>
        <Button onClick={handleLoginClick}>登录</Button>
      </div>
    );
  }

  const records = data?.records || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">识别历史</h1>
          <p className="text-muted-foreground">共 {total} 条记录</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : records.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">暂无识别记录</p>
          </Card>
        ) : (
          <>
            <div className="space-y-4 mb-8">
              {records.map((record) => (
                <Card
                  key={record.id}
                  className="p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{record.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(record.createdAt).toLocaleString()}
                      </p>
                      {record.status === "error" && (
                        <p className="text-sm text-destructive mt-1">
                          错误: {record.errorMessage}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      {record.status === "done" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewRecord(record)}
                            title="查看详情"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExport(record, "xlsx")}
                            title="导出 Excel"
                          >
                            <Download className="w-4 h-4" />
                            XLSX
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExport(record, "csv")}
                            title="导出 CSV"
                          >
                            <Download className="w-4 h-4" />
                            CSV
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(record.id)}
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* 分页控制 */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                第 {currentPage} / {totalPages} 页
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isFetching}
                >
                  <ChevronLeft className="w-4 h-4" />
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || isFetching}
                >
                  下一页
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 查看详情弹窗 */}
      <Dialog open={!!viewRecord} onOpenChange={() => setViewRecord(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewRecord?.title}</DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <div className="mt-4">
              <div className="mb-4 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleExport(viewRecord, "xlsx")}
                >
                  <Download className="w-4 h-4 mr-2" />
                  导出 Excel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExport(viewRecord, "csv")}
                >
                  <Download className="w-4 h-4 mr-2" />
                  导出 CSV
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-border">
                  <tbody>
                    {(() => {
                      try {
                        const tableData = JSON.parse(viewRecord.tableData);
                        return tableData.map(
                          (row: string[], rowIdx: number) => (
                            <tr key={rowIdx}>
                              {row.map((cell: string, cellIdx: number) => (
                                <td
                                  key={cellIdx}
                                  className="border border-border px-3 py-2 text-sm"
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          )
                        );
                      } catch {
                        return (
                          <tr>
                            <td className="border border-border px-3 py-2 text-sm text-destructive">
                              表格数据格式错误
                            </td>
                          </tr>
                        );
                      }
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除这条识别记录吗？此操作无法撤销。
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                "删除"
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
