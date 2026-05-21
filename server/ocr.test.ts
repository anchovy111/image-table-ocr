import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";
import { appRouter } from "./routers";
import { TrpcContext } from "./_core/trpc";

// Mock database functions
vi.mock("./ocrDb", () => ({
  createOcrRecord: vi.fn(),
  getOcrRecordById: vi.fn(),
  listOcrRecords: vi.fn(),
  deleteOcrRecord: vi.fn(),
  listOcrRecordsPaginated: vi.fn(),
  updateOcrRecord: vi.fn(),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

import { createOcrRecord, getOcrRecordById, listOcrRecords, deleteOcrRecord, listOcrRecordsPaginated, updateOcrRecord } from "./ocrDb";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";

function createMockContext(userId = 1): TrpcContext {
  return {
    user: {
      id: userId,
      openId: "test-open-id",
      name: "Test User",
      role: "user",
    },
    req: {} as any,
    res: {} as any,
  };
}

describe("ocr.uploadImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createOcrRecord).mockResolvedValue(1);
    vi.mocked(storagePut).mockResolvedValue({
      url: "/manus-storage/test.jpg",
      key: "ocr/1/test.jpg",
    });
  });

  it("should upload image and create OCR record", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ocr.uploadImage({
      filename: "test.jpg",
      mimeType: "image/jpeg",
      base64Data: "base64encodeddata",
    });

    expect(result).toEqual({
      recordId: 1,
      imageUrl: "/manus-storage/test.jpg",
    });
    expect(vi.mocked(createOcrRecord)).toHaveBeenCalled();
  });

  it("should handle Chinese filename by converting to ASCII", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ocr.uploadImage({
      filename: "表格识别.jpg",
      mimeType: "image/jpeg",
      base64Data: "base64encodeddata",
    });

    expect(result).toEqual({
      recordId: 1,
      imageUrl: "/manus-storage/test.jpg",
    });

    // 验证 storagePut 被调用时，文件名已转换为 ASCII
    const storageCall = vi.mocked(storagePut).mock.calls[0];
    const storagePath = storageCall[0] as string;
    // 路径应该包含转换后的文件名（中文转为下划线）
    expect(storagePath).toMatch(/ocr\/1\/\d+-file\.jpg/);
    // 路径不应该包含中文字符
    expect(storagePath).not.toMatch(/[\u4e00-\u9fa5]/);
  });

  it("should handle non-ASCII extension names", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ocr.uploadImage({
      filename: "test.图片",
      mimeType: "image/jpeg",
      base64Data: "base64encodeddata",
    });

    expect(result).toEqual({
      recordId: 1,
      imageUrl: "/manus-storage/test.jpg",
    });

    // 验证扩展名也被转换为 ASCII
    const storageCall = vi.mocked(storagePut).mock.calls[0];
    const storagePath = storageCall[0] as string;
    // 路径不应该包含任何非 ASCII 字符
    expect(storagePath).not.toMatch(/[\u4e00-\u9fa5]/);
  });

  it("should handle PDF files with Chinese names", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ocr.uploadImage({
      filename: "表格数据.pdf",
      mimeType: "application/pdf",
      base64Data: "base64encodeddata",
    });

    expect(result).toEqual({
      recordId: 1,
      imageUrl: "/manus-storage/test.jpg",
    });

    // 验证 PDF 文件名和扩展名都被转换为 ASCII
    const storageCall = vi.mocked(storagePut).mock.calls[0];
    const storagePath = storageCall[0] as string;
    // 路径不应该包含任何非 ASCII 字符
    expect(storagePath).not.toMatch(/[\u4e00-\u9fa5]/);
    // 应该包含 pdf 扩展名
    expect(storagePath).toMatch(/\.pdf$/);
  });
});

describe("ocr.listRecords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockRecords = [
      {
        id: 1,
        userId: 1,
        title: "test",
        imageUrl: "/manus-storage/test.jpg",
        imageKey: "ocr/1/test.jpg",
        originalFilename: "test.jpg",
        tableData: JSON.stringify([["A", "B"], ["1", "2"]]),
        status: "done" as const,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    vi.mocked(listOcrRecords).mockResolvedValue(mockRecords);
  });

  it("should list OCR records for user", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ocr.listRecords();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});

describe("ocr.getRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockRecord = {
      id: 1,
      userId: 1,
      title: "test",
      imageUrl: "/manus-storage/test.jpg",
      imageKey: "ocr/1/test.jpg",
      originalFilename: "test.jpg",
      tableData: JSON.stringify([["A", "B"], ["1", "2"]]),
      status: "done" as const,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(getOcrRecordById).mockResolvedValue(mockRecord);
  });

  it("should get OCR record by ID", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ocr.getRecord({ recordId: 1 });

    expect(result.id).toBe(1);
    expect(result.title).toBe("test");
  });

  it("should throw error if record not found", async () => {
    vi.mocked(getOcrRecordById).mockResolvedValue(undefined);
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.ocr.getRecord({ recordId: 999 });
      expect.fail("Should throw error");
    } catch (error: any) {
      expect(error.code).toBe("NOT_FOUND");
    }
  });
});

describe("ocr.listRecordsPaginated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockRecords = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      userId: 1,
      title: `test-${i}`,
      imageUrl: `/manus-storage/test-${i}.jpg`,
      imageKey: `ocr/1/test-${i}.jpg`,
      originalFilename: `test-${i}.jpg`,
      tableData: JSON.stringify([["A", "B"], ["1", "2"]]),
      status: "done" as const,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    vi.mocked(listOcrRecordsPaginated).mockResolvedValue({
      records: mockRecords,
      total: 50,
      hasMore: true,
    });
  });

  it("should list paginated OCR records", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ocr.listRecordsPaginated({ page: 1 });

    expect(result.records).toHaveLength(20);
    expect(result.total).toBe(50);
    expect(result.hasMore).toBe(true);
  });

  it("should list second page of OCR records", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ocr.listRecordsPaginated({ page: 2 });

    expect(result.records).toHaveLength(20);
    expect(result.total).toBe(50);
    expect(result.hasMore).toBe(true);
  });
});

describe("ocr.deleteRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockRecord = {
      id: 1,
      userId: 1,
      title: "test",
      imageUrl: "/manus-storage/test.jpg",
      imageKey: "ocr/1/test.jpg",
      originalFilename: "test.jpg",
      tableData: JSON.stringify([["A"], ["1"]]),
      status: "done" as const,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(getOcrRecordById).mockResolvedValue(mockRecord);
    vi.mocked(deleteOcrRecord).mockResolvedValue(undefined);
  });

  it("should delete OCR record", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ocr.deleteRecord({ recordId: 1 });

    expect(result).toEqual({ success: true });
  });
});

describe("ocr.updateTableData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockRecord = {
      id: 1,
      userId: 1,
      title: "test",
      imageUrl: "/manus-storage/test.jpg",
      imageKey: "ocr/1/test.jpg",
      originalFilename: "test.jpg",
      tableData: JSON.stringify([["A"], ["1"]]),
      status: "done" as const,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(getOcrRecordById).mockResolvedValue(mockRecord);
    vi.mocked(updateOcrRecord).mockResolvedValue(undefined);
  });

  it("should update table data", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const newData = { headers: ["列1", "列2"], rows: [["值1", "值2"]] };
    const result = await caller.ocr.updateTableData({
      recordId: 1,
      tableData: newData,
    });

    expect(result).toEqual({ success: true });
  });
});

describe("ocr.updateTableData - format consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockRecord = {
      id: 1,
      userId: 1,
      title: "测试",
      imageUrl: "/manus-storage/test.jpg",
      imageKey: "ocr/1/test.jpg",
      originalFilename: "test.jpg",
      tableData: JSON.stringify([["旧列1", "旧列2"], ["旧值1", "旧值2"]]),
      status: "done" as const,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(getOcrRecordById).mockResolvedValue(mockRecord);
    vi.mocked(updateOcrRecord).mockResolvedValue(undefined);
  });

  it("should save table data in 2D array format [headers, ...rows]", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const newData = { headers: ["列1", "列2"], rows: [["值1", "值2"]] };
    const result = await caller.ocr.updateTableData({
      recordId: 1,
      tableData: newData,
    });

    // 验证返回成功
    expect(result).toEqual({ success: true });

    // 验证 updateOcrRecord 被调用
    expect(vi.mocked(updateOcrRecord)).toHaveBeenCalled();

    // 验证 updateOcrRecord 被调用时，tableData 已转换为二维数组格式
    const updateCall = vi.mocked(updateOcrRecord).mock.calls[0];
    const savedData = JSON.parse(updateCall[2].tableData as string);
    // 预期格式：[["列1", "列2"], ["值1", "值2"]]
    expect(Array.isArray(savedData)).toBe(true);
    expect(savedData).toHaveLength(2);
    expect(savedData[0]).toEqual(["列1", "列2"]);
    expect(savedData[1]).toEqual(["值1", "值2"]);
  });
});

describe("ocr.recognize with PDF", () => {
  it("should handle PDF files with base64 data URL", async () => {
    vi.clearAllMocks();
    const mockRecord = {
      id: 1,
      userId: 1,
      title: "test.pdf",
      imageUrl: "/manus-storage/test.pdf",
      imageKey: "ocr/1/test.pdf",
      originalFilename: "test.pdf",
      tableData: JSON.stringify([["A", "B"], ["1", "2"]]),
      status: "done" as const,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(createOcrRecord).mockResolvedValue(1);
    vi.mocked(storagePut).mockResolvedValue({
      url: "/manus-storage/test.pdf",
      key: "ocr/1/test.pdf",
    });
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([["A", "B"], ["1", "2"]]),
          },
        },
      ],
    } as any);

    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ocr.uploadImage({
      filename: "test.pdf",
      mimeType: "application/pdf",
      base64Data: "base64encodedpdfdata",
    });

    expect(result.recordId).toBe(1);
  });
});
