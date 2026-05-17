import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM, type Message } from "../_core/llm";
import { storagePut } from "../storage";
import {
  createOcrRecord,
  updateOcrRecord,
  getOcrRecordById,
  listOcrRecords,
  deleteOcrRecord,
} from "../ocrDb";

function getMimeType(filename?: string | null): string {
  if (!filename) return "image/jpeg";
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

const TableDataSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

type TableData = z.infer<typeof TableDataSchema>;

export const ocrRouter = router({
  uploadImage: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        mimeType: z.string(),
        base64Data: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64Data, "base64");

      const { url, key } = await storagePut(
        `ocr/${ctx.user.id}/${Date.now()}-${input.filename}`,
        buffer,
        input.mimeType
      );

      const recordId = await createOcrRecord({
        userId: ctx.user.id,
        title: input.filename.replace(/\.[^.]+$/, ""),
        imageUrl: url,
        imageKey: key,
        originalFilename: input.filename,
        base64Data: input.base64Data,
        tableData: JSON.stringify({ headers: [], rows: [] }),
        status: "pending",
      } as any);

      return { recordId, imageUrl: url };
    }),

  recognize: protectedProcedure
    .input(z.object({ recordId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const record = await getOcrRecordById(input.recordId, ctx.user.id);
      if (!record) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "识别记录不存在",
        });
      }

      // Mark as processing
      await updateOcrRecord(input.recordId, ctx.user.id, { status: "processing" });

      try {
        const prompt = `请仔细分析这张图片中的表格内容，并以严格的 JSON 格式返回提取结果。

要求：
1. 识别图片中所有表格的完整内容
2. 如果有多个表格，合并为一个，以第一个表格的表头为准
3. 保持原始数据的完整性，不要修改或省略任何内容
4. 对于合并单元格，在每个对应位置重复填写内容
5. 空单元格用空字符串 "" 表示

返回格式（严格 JSON，不要包含任何其他文字）：
{
  "headers": ["列名1", "列名2", "列名3"],
  "rows": [
    ["数据1", "数据2", "数据3"],
    ["数据4", "数据5", "数据6"]
  ]
}

如果图片中没有表格，返回：
{
  "headers": ["内容"],
  "rows": [["未检测到表格数据"]]
}`;

        // Determine content type based on file extension
        const isPdf = record.imageKey.toLowerCase().endsWith(".pdf") ||
          (record.originalFilename?.toLowerCase().endsWith(".pdf") ?? false);

        const userMessage: Message = {
          role: "user",
          content: isPdf
            ? [
                {
                  type: "file_url" as const,
                  file_url: {
                    url: record.imageUrl,
                    mime_type: "application/pdf" as const,
                  },
                },
                {
                  type: "text" as const,
                  text: prompt,
                },
              ]
            : [
                {
                  type: "image_url" as const,
                  image_url: {
                    url: `data:${getMimeType(record.originalFilename)};base64,${record.base64Data}`,
                    detail: "high" as const,
                  },
                },
                {
                  type: "text" as const,
                  text: prompt,
                },
              ],
        };

        let response;
        try {
          response = await invokeLLM({
            messages: [userMessage],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "table_extraction",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    headers: {
                      type: "array",
                      items: { type: "string" },
                      description: "表格列标题数组",
                    },
                    rows: {
                      type: "array",
                      items: {
                        type: "array",
                        items: { type: "string" },
                      },
                      description: "表格数据行，每行是一个字符串数组",
                    },
                  },
                  required: ["headers", "rows"],
                  additionalProperties: false,
                },
              },
            },
          });
        } catch (llmErr) {
          console.error("[OCR] LLM invocation failed:", llmErr);
          throw llmErr;
        }

        // Log full response for debugging
        console.log("[OCR] LLM response type:", typeof response);
        console.log("[OCR] LLM response keys:", response ? Object.keys(response) : "null");
        console.log("[OCR] Full LLM response:", JSON.stringify(response).substring(0, 1000));

        // Defensive checks for LLM response
        if (!response) {
          console.error("[OCR] LLM response is null/undefined");
          throw new Error("AI 返回为空");
        }

        if ((response as any).error) {
          const errorMsg = ((response as any).error as any).message || JSON.stringify((response as any).error);
          console.error("[OCR] LLM API error:", errorMsg);
          throw new Error(`LLM API 错误: ${errorMsg}`);
        }

        if (!response.choices) {
          console.error("[OCR] LLM response.choices is missing:", response);
          throw new Error("AI 返回格式错误：choices 字段不存在");
        }

        if (!Array.isArray(response.choices)) {
          console.error("[OCR] LLM response.choices is not an array, type:", typeof response.choices, "value:", response.choices);
          throw new Error("AI 返回格式错误：choices 不是数组");
        }

        if (response.choices.length === 0) {
          console.error("[OCR] LLM response.choices is empty");
          throw new Error("AI 返回格式错误：choices 数组为空");
        }

        const choice = response.choices[0];
        if (!choice || !choice.message) {
          console.error("[OCR] LLM choice or message missing:", choice);
          throw new Error("AI 返回格式错误：message 不存在");
        }

        const rawContent = choice.message.content;
        if (rawContent === undefined || rawContent === null) {
          console.error("[OCR] LLM content is null/undefined:", choice.message);
          throw new Error("AI 返回内容为空");
        }

        // content can be string or array of content parts
        let content: string;
        if (typeof rawContent === "string") {
          content = rawContent;
        } else if (Array.isArray(rawContent)) {
          content = rawContent.map((p: any) => (p && p.type === "text" ? p.text : "")).join("");
        } else {
          console.error("[OCR] Unexpected content type:", typeof rawContent, rawContent);
          throw new Error("AI 返回内容格式不支持");
        }

        if (!content || content.trim().length === 0) {
          console.error("[OCR] Content is empty after processing");
          throw new Error("AI 返回内容处理后为空");
        }

        let parsed;
        try {
          parsed = TableDataSchema.parse(JSON.parse(content));
        } catch (parseErr) {
          console.error("[OCR] JSON parse error:", parseErr, "content:", content);
          throw parseErr;
        }

        await updateOcrRecord(input.recordId, ctx.user.id, {
          tableData: JSON.stringify(parsed),
          status: "done",
        });

        return { success: true, tableData: parsed };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "识别失败";
        await updateOcrRecord(input.recordId, ctx.user.id, {
          status: "error",
          errorMessage,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `AI 识别失败: ${errorMessage}`,
        });
      }
    }),

  listRecords: protectedProcedure.query(async ({ ctx }) => {
    const records = await listOcrRecords(ctx.user.id);
    return records.map((r) => ({
      ...r,
      tableData: JSON.parse(r.tableData),
    }));
  }),

  getRecord: protectedProcedure
    .input(z.object({ recordId: z.number() }))
    .query(async ({ ctx, input }) => {
      const record = await getOcrRecordById(input.recordId, ctx.user.id);
      if (!record) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "识别记录不存在",
        });
      }
      return {
        ...record,
        tableData: JSON.parse(record.tableData),
      };
    }),

  deleteRecord: protectedProcedure
    .input(z.object({ recordId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const record = await getOcrRecordById(input.recordId, ctx.user.id);
      if (!record) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "识别记录不存在",
        });
      }
      await deleteOcrRecord(input.recordId, ctx.user.id);
      return { success: true };
    }),

  updateTableData: protectedProcedure
    .input(
      z.object({
        recordId: z.number(),
        tableData: z.object({
          headers: z.array(z.string()),
          rows: z.array(z.array(z.string())),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const record = await getOcrRecordById(input.recordId, ctx.user.id);
      if (!record) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "识别记录不存在",
        });
      }

      const validated = TableDataSchema.parse(input.tableData);
      await updateOcrRecord(input.recordId, ctx.user.id, {
        tableData: JSON.stringify(validated),
      });

      return { success: true };
    }),
});
