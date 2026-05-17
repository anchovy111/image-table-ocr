import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import { exportToCSV, exportToXLSX, TableData } from "@/lib/exportUtils";
import { toast } from "sonner";

interface ExportMenuProps {
  tableData: TableData;
  filename?: string;
  disabled?: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}

export function ExportMenu({
  tableData,
  filename = "表格数据",
  disabled = false,
  variant = "outline",
  size = "default",
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);

  const handleExportXLSX = () => {
    try {
      exportToXLSX(tableData, filename);
      toast.success("已导出为 Excel 文件");
    } catch {
      toast.error("导出失败，请重试");
    }
    setOpen(false);
  };

  const handleExportCSV = () => {
    try {
      exportToCSV(tableData, filename);
      toast.success("已导出为 CSV 文件");
    } catch {
      toast.error("导出失败，请重试");
    }
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled} className="gap-2">
          <Download className="h-4 w-4" />
          导出
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={handleExportXLSX} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          <span>导出为 Excel</span>
          <span className="ml-auto text-xs text-muted-foreground">.xlsx</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4 text-blue-600" />
          <span>导出为 CSV</span>
          <span className="ml-auto text-xs text-muted-foreground">.csv</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
