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

const TableDataSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

export const ocrRouter = router({
  // Upload image and create a pending record
  uploadImage: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        mimeType: z.string(),
        base64Data: z.string(), // base64 encoded file content
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { filename, mimeType, base64Data } = input;

      // Decode base64 to buffer
      const buffer = Buffer.from(base64Data, "base64");
      const fileKey = `ocr/${ctx.user.id}/${Date.now()}-${filename}`;

      const { url } = await storagePut(fileKey, buffer, mimeType);

      // Create pending record
      const title = filename.replace(/\.[^/.]+$/, "") || "未命名识别";
      const recordId = await createOcrRecord({
        userId: ctx.user.id,
        title,
        imageUrl: url,
        imageKey: fileKey,
        originalFilename: filename,
        tableData: JSON.stringify({ headers: [], rows: [] }),
        status: "pending",
      });

      return { recordId, imageUrl: url };
    }),

  // Trigger AI recognition for a record
  recognize: protectedProcedure
    .input(z.object({ recordId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const record = await getOcrRecordById(input.recordId, ctx.user.id);
      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "识别记录不存在" });
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
                    url: record.imageUrl,
                    detail: "high" as const,
                  },
                },
                {
                  type: "text" as const,
                  text: prompt,
                },
              ],
        };

        const response = await invokeLLM({
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

                const rawContent = response.choices[0]?.message?.content;
        if (!rawContent) {
          throw new Error("AI 返回内容为空");
        }
        // content can be string or array of content parts
        const content = typeof rawContent === "string"
          ? rawContent
          : rawContent.map((p) => (p.type === "text" ? p.text : "")).join("");
        const parsed = TableDataSchema.parse(JSON.parse(content));

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

  // Get a single record
  getRecord: protectedProcedure
    .input(z.object({ recordId: z.number() }))
    .query(async ({ ctx, input }) => {
      const record = await getOcrRecordById(input.recordId, ctx.user.id);
      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "识别记录不存在" });
      }
      return {
        ...record,
        tableData: JSON.parse(record.tableData) as { headers: string[]; rows: string[][] },
      };
    }),

  // List all records for the current user
  listRecords: protectedProcedure.query(async ({ ctx }) => {
    const records = await listOcrRecords(ctx.user.id);
    return records.map((r) => ({
      ...r,
      tableData: JSON.parse(r.tableData) as { headers: string[]; rows: string[][] },
    }));
  }),

  // Update table data (inline editing)
  updateTableData: protectedProcedure
    .input(
      z.object({
        recordId: z.number(),
        tableData: TableDataSchema,
        title: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const record = await getOcrRecordById(input.recordId, ctx.user.id);
      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "识别记录不存在" });
      }
      await updateOcrRecord(input.recordId, ctx.user.id, {
        tableData: JSON.stringify(input.tableData),
        ...(input.title ? { title: input.title } : {}),
      });
      return { success: true };
    }),

  // Delete a record
  deleteRecord: protectedProcedure
    .input(z.object({ recordId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteOcrRecord(input.recordId, ctx.user.id);
      return { success: true };
    }),
});
