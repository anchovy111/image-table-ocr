import React, { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface TableData {
  headers: string[];
  rows: string[][];
}

interface EditableCellProps {
  value: string;
  isHeader?: boolean;
  onChange: (value: string) => void;
  rowIndex: number;
  colIndex: number;
}

function EditableCell({ value, isHeader, onChange, rowIndex, colIndex }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleClick = () => setEditing(true);

  const handleBlur = () => {
    setEditing(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setEditing(false);
      if (localValue !== value) onChange(localValue);
    }
    if (e.key === "Escape") {
      setEditing(false);
      setLocalValue(value);
    }
  };

  const Tag = isHeader ? "th" : "td";

  return (
    <Tag
      className={cn(
        "relative px-4 py-2.5 text-sm border-b border-r border-border/50 last:border-r-0",
        "cursor-pointer select-none transition-colors duration-150",
        isHeader
          ? "bg-muted/60 font-semibold text-foreground/80 text-xs uppercase tracking-wider sticky top-0 z-10"
          : "bg-card text-foreground hover:bg-accent/20",
        editing && "cell-editing p-0"
      )}
      onClick={!isHeader ? handleClick : undefined}
      onDoubleClick={isHeader ? handleClick : undefined}
      title="双击编辑"
      data-row={rowIndex}
      data-col={colIndex}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full h-full px-4 py-2.5 bg-transparent outline-none text-sm text-foreground"
          style={{ minWidth: "80px" }}
        />
      ) : (
        <span className="block truncate max-w-[240px]">{value || <span className="text-muted-foreground/40 italic">空</span>}</span>
      )}
    </Tag>
  );
}

interface EditableTableProps {
  data: TableData;
  onChange?: (data: TableData) => void;
  readOnly?: boolean;
  className?: string;
}

export function EditableTable({ data, onChange, readOnly = false, className }: EditableTableProps) {
  const handleHeaderChange = useCallback(
    (colIndex: number, newValue: string) => {
      if (readOnly || !onChange) return;
      const newHeaders = [...data.headers];
      newHeaders[colIndex] = newValue;
      onChange({ ...data, headers: newHeaders });
    },
    [data, onChange, readOnly]
  );

  const handleCellChange = useCallback(
    (rowIndex: number, colIndex: number, newValue: string) => {
      if (readOnly || !onChange) return;
      const newRows = data.rows.map((row) => [...row]);
      if (!newRows[rowIndex]) newRows[rowIndex] = [];
      newRows[rowIndex][colIndex] = newValue;
      onChange({ ...data, rows: newRows });
    },
    [data, onChange, readOnly]
  );

  if (!data.headers.length && !data.rows.length) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        暂无表格数据
      </div>
    );
  }

  return (
    <div className={cn("overflow-auto rounded-lg border border-border/60", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60">
            {data.headers.map((header, colIndex) => (
              <EditableCell
                key={colIndex}
                value={header}
                isHeader
                onChange={(v) => handleHeaderChange(colIndex, v)}
                rowIndex={-1}
                colIndex={colIndex}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={cn(
                "border-b border-border/40 last:border-b-0 transition-colors",
                rowIndex % 2 === 0 ? "bg-card" : "bg-muted/20"
              )}
            >
              {data.headers.map((_, colIndex) => (
                <EditableCell
                  key={colIndex}
                  value={row[colIndex] ?? ""}
                  onChange={(v) => handleCellChange(rowIndex, colIndex, v)}
                  rowIndex={rowIndex}
                  colIndex={colIndex}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <div className="px-4 py-2 bg-muted/30 border-t border-border/40 text-xs text-muted-foreground">
          点击单元格可直接编辑内容，按 Enter 确认，Esc 取消；双击表头可编辑列名
        </div>
      )}
    </div>
  );
}
