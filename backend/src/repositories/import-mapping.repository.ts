import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import type { ColumnMapping } from "../services/importers/generic.parser.js";

/**
 * Persistence for saved import column mappings (KAN-163). A mapping is keyed by
 * `(userId, headerSignature)` so a repeat import of the same bank reuses it.
 */

export interface SavedImportMapping {
  headerSignature: string;
  format: string | null;
  mapping: ColumnMapping;
}

export async function findBySignature(
  userId: string,
  headerSignature: string,
): Promise<SavedImportMapping | null> {
  if (!headerSignature) return null;
  const row = await prisma.importColumnMapping.findUnique({
    where: { userId_headerSignature: { userId, headerSignature } },
  });
  if (!row) return null;
  return {
    headerSignature: row.headerSignature,
    format: row.format,
    mapping: row.mapping as unknown as ColumnMapping,
  };
}

export async function upsertMapping(params: {
  userId: string;
  headerSignature: string;
  format?: string | null;
  mapping: ColumnMapping;
}): Promise<void> {
  const { userId, headerSignature, mapping } = params;
  const format = params.format ?? null;
  const json = mapping as unknown as Prisma.InputJsonValue;

  await prisma.$transaction((tx) =>
    tx.importColumnMapping.upsert({
      where: { userId_headerSignature: { userId, headerSignature } },
      create: { userId, headerSignature, format, mapping: json },
      update: { format, mapping: json },
    }),
  );
}
