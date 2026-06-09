import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import type { ColumnMapping } from "../services/importers/generic.parser.js";

/**
 * Persistence for saved import column mappings (KAN-163). A mapping is keyed by
 * `(userId, headerSignature)` so a repeat import of the same bank reuses it.
 */

export interface SavedImportMapping {
  headerSignature: string;
  name: string | null;
  format: string | null;
  mapping: ColumnMapping;
}

/** A user-named mapping, offered as a reusable option in the wizard. */
export interface NamedImportMapping {
  id: string;
  name: string;
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
    name: row.name,
    format: row.format,
    mapping: row.mapping as unknown as ColumnMapping,
  };
}

/**
 * Lists the user's named mappings, most-recent first and de-duplicated by name
 * (a name may be re-used across several header signatures; the latest wins), for
 * the wizard's reusable-mapping dropdown.
 */
export async function findNamedByUser(userId: string): Promise<NamedImportMapping[]> {
  const rows = await prisma.importColumnMapping.findMany({
    where: { userId, name: { not: null } },
    orderBy: { updatedAt: "desc" },
  });
  const seen = new Set<string>();
  const result: NamedImportMapping[] = [];
  for (const row of rows) {
    const name = row.name!;
    if (seen.has(name)) continue;
    seen.add(name);
    result.push({ id: row.id, name, mapping: row.mapping as unknown as ColumnMapping });
  }
  return result;
}

export async function upsertMapping(params: {
  userId: string;
  headerSignature: string;
  name?: string | null;
  format?: string | null;
  mapping: ColumnMapping;
}): Promise<void> {
  const { userId, headerSignature, mapping } = params;
  const format = params.format ?? null;
  const name = params.name ?? null;
  const json = mapping as unknown as Prisma.InputJsonValue;

  await prisma.$transaction((tx) =>
    tx.importColumnMapping.upsert({
      where: { userId_headerSignature: { userId, headerSignature } },
      create: { userId, headerSignature, name, format, mapping: json },
      // Only overwrite the stored name when a new one is supplied, so a later
      // unnamed auto-save does not wipe a name the user gave earlier.
      update: { format, mapping: json, ...(name !== null ? { name } : {}) },
    }),
  );
}
