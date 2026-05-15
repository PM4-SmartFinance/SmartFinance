import { prisma } from "../prisma.js";
import type { ModuleStorageAdapter } from "../types/module.js";

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function getData(moduleName: string, userId: string, key: string): Promise<unknown> {
  const row = await prisma.moduleData.findUnique({
    where: { moduleName_userId_key: { moduleName, userId, key } },
    select: { value: true },
  });
  return row ? safeParseJson(row.value) : null;
}

export async function setData(
  moduleName: string,
  userId: string,
  key: string,
  value: unknown,
): Promise<void> {
  await prisma.moduleData.upsert({
    where: { moduleName_userId_key: { moduleName, userId, key } },
    create: { moduleName, userId, key, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
}

export async function deleteData(moduleName: string, userId: string, key: string): Promise<void> {
  await prisma.moduleData.deleteMany({ where: { moduleName, userId, key } });
}

export async function listData(
  moduleName: string,
  userId: string,
): Promise<Array<{ key: string; value: unknown }>> {
  const rows = await prisma.moduleData.findMany({
    where: { moduleName, userId },
    select: { key: true, value: true },
    orderBy: { key: "asc" },
  });
  return rows.map((r) => ({ key: r.key, value: safeParseJson(r.value) }));
}

export function createStorageAdapter(moduleName: string): ModuleStorageAdapter {
  return {
    get: (userId, key) => getData(moduleName, userId, key),
    set: (userId, key, value) => setData(moduleName, userId, key, value),
    delete: (userId, key) => deleteData(moduleName, userId, key),
    list: (userId) => listData(moduleName, userId),
  };
}
