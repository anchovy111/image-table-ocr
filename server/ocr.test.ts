import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock("./ocrDb", () => ({
  createOcrRecord: vi.fn().mockResolvedValue(1),
  updateOcrRecord: vi.fn().mockResolvedValue(undefined),
  getOcrRecordById: vi.fn(),
  listOcrRecords: vi.fn().mockResolvedValue([]),
  deleteOcrRecord: vi.fn().mockResolvedValue(undefined),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    key: "ocr/1/test.jpg",
    url: "/manus-storage/ocr/1/test.jpg",
  }),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            headers: ["姓名", "年龄", "城市"],
            rows: [
              ["张三", "25", "北京"],
              ["李四", "30", "上海"],
            ],
          }),
        },
      },
    ],
  }),
}));

import { createOcrRecord, getOcrRecordById, listOcrRecords, deleteOcrRecord } from "./ocrDb";

function createMockContext(userId = 1): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
      name: "测试用户",
      email: "test@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("ocr.uploadImage", () => {
  it("should upload image and create a pending record", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ocr.uploadImage({
      filename: "test.jpg",
      mimeType: "image/jpeg",
      base64Data: Buffer.from("fake image data").toString("base64"),
    });

    expect(result).toHaveProperty("recordId", 1);
    expect(result).toHaveProperty("imageUrl");
    expect(createOcrRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        status: "pending",
        originalFilename: "test.jpg",
      })
    );
  });
});

describe("ocr.listRecords", () => {
  it("should return empty list when no records", async () => {
    vi.mocked(listOcrRecords).mockResolvedValueOnce([]);
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ocr.listRecords();
    expect(result).toEqual([]);
  });

  it("should return records with parsed tableData", async () => {
    const mockRecord = {
      id: 1,
      userId: 1,
      title: "测试记录",
      imageUrl: "/manus-storage/test.jpg",
      imageKey: "ocr/1/test.jpg",
      originalFilename: "test.jpg",
      tableData: JSON.stringify({ headers: ["A", "B"], rows: [["1", "2"]] }),
      status: "done" as const,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(listOcrRecords).mockResolvedValueOnce([mockRecord]);

    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.ocr.listRecords();

    expect(result).toHaveLength(1);
    expect(result[0].tableData).toEqual({ headers: ["A", "B"], rows: [["1", "2"]] });
  });
});

describe("ocr.getRecord", () => {
  it("should throw NOT_FOUND when record does not exist", async () => {
    vi.mocked(getOcrRecordById).mockResolvedValueOnce(undefined);
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.ocr.getRecord({ recordId: 999 })).rejects.toThrow("识别记录不存在");
  });

  it("should return record with parsed tableData", async () => {
    const mockRecord = {
      id: 1,
      userId: 1,
      title: "测试",
      imageUrl: "/manus-storage/test.jpg",
      imageKey: "ocr/1/test.jpg",
      originalFilename: "test.jpg",
      tableData: JSON.stringify({ headers: ["X"], rows: [["val"]] }),
      status: "done" as const,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(getOcrRecordById).mockResolvedValueOnce(mockRecord);

    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.ocr.getRecord({ recordId: 1 });

    expect(result.tableData).toEqual({ headers: ["X"], rows: [["val"]] });
  });
});

describe("ocr.deleteRecord", () => {
  it("should delete a record successfully", async () => {
    const mockRecord = {
      id: 1,
      userId: 1,
      title: "测试",
      imageUrl: "/manus-storage/test.jpg",
      imageKey: "ocr/1/test.jpg",
      originalFilename: "test.jpg",
      tableData: JSON.stringify({ headers: ["X"], rows: [["val"]] }),
      status: "done" as const,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(getOcrRecordById).mockResolvedValueOnce(mockRecord);

    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ocr.deleteRecord({ recordId: 1 });
    expect(result).toEqual({ success: true });
    expect(deleteOcrRecord).toHaveBeenCalledWith(1, 1);
  });
});

describe("ocr.updateTableData", () => {
  beforeEach(() => {
    const mockRecord = {
      id: 1,
      userId: 1,
      title: "测试",
      imageUrl: "/manus-storage/test.jpg",
      imageKey: "ocr/1/test.jpg",
      originalFilename: "test.jpg",
      tableData: JSON.stringify({ headers: ["A"], rows: [["1"]] }),
      status: "done" as const,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(getOcrRecordById).mockResolvedValue(mockRecord);
  });

  it("should update table data successfully", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const newData = { headers: ["姓名", "年龄"], rows: [["张三", "25"]] };
    const result = await caller.ocr.updateTableData({
      recordId: 1,
      tableData: newData,
    });

    expect(result).toEqual({ success: true });
  });
});
