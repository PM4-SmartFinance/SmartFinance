import { prisma } from "../prisma.js";
import { ServiceError } from "../errors.js";
import { getLogger } from "../logger.js";
import type { ModuleStorageAdapter } from "../types/module.js";

const MAX_VALUE_BYTES = 65_536;

function safeParseJson(
  raw: string,
  context: { moduleName: string; userId: string; key: string },
): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (err) {
    getLogger().error({ err, ...context }, "module-storage: corrupt JSON value, returning null");
    return null;
  }
}

export async function getData(moduleName: string, userId: string, key: string): Promise<unknown> {
  const row = await prisma.moduleData.findUnique({
    where: { moduleName_userId_key: { moduleName, userId, key } },
    select: { value: true },
  });
  return row ? safeParseJson(row.value, { moduleName, userId, key }) : null;
}

export async function setData(
  moduleName: string,
  userId: string,
  key: string,
  value: unknown,
): Promise<void> {
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > MAX_VALUE_BYTES) {
    throw new ServiceError(
      413,
      `module storage value exceeds maximum size of ${MAX_VALUE_BYTES} bytes`,
    );
  }
  await prisma.moduleData.upsert({
    where: { moduleName_userId_key: { moduleName, userId, key } },
    create: { moduleName, userId, key, value: serialized },
    update: { value: serialized },
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
  return rows.map((r) => ({
    key: r.key,
    value: safeParseJson(r.value, { moduleName, userId, key: r.key }),
  }));
}

export function createStorageAdapter(moduleName: string): ModuleStorageAdapter {
  return {
    get: (userId, key) => getData(moduleName, userId, key),
    set: (userId, key, value) => setData(moduleName, userId, key, value),
    delete: (userId, key) => deleteData(moduleName, userId, key),
    list: (userId) => listData(moduleName, userId),
  };
}
