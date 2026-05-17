import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db";
import { ocrRecords, InsertOcrRecord, OcrRecord } from "../drizzle/schema";

export async function createOcrRecord(data: InsertOcrRecord): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(ocrRecords).values(data);
  return (result[0] as { insertId: number }).insertId;
}

export async function updateOcrRecord(
  id: number,
  userId: number,
  data: Partial<Pick<OcrRecord, "title" | "tableData" | "status" | "errorMessage">>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(ocrRecords)
    .set(data)
    .where(and(eq(ocrRecords.id, id), eq(ocrRecords.userId, userId)));
}

export async function getOcrRecordById(id: number, userId: number): Promise<OcrRecord | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .select()
    .from(ocrRecords)
    .where(and(eq(ocrRecords.id, id), eq(ocrRecords.userId, userId)))
    .limit(1);
  return result[0];
}

export async function listOcrRecords(userId: number): Promise<OcrRecord[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(ocrRecords)
    .where(eq(ocrRecords.userId, userId))
    .orderBy(desc(ocrRecords.createdAt));
}

export async function deleteOcrRecord(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(ocrRecords)
    .where(and(eq(ocrRecords.id, id), eq(ocrRecords.userId, userId)));
}
