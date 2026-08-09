import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import type { Database, DatabaseTransaction } from "../../../core/database/client.js";
import { moderationAuditEvents, moderationCustomCaseTypeAliases, moderationCustomCaseTypes, type ModerationCustomCaseType } from "../database/schema.js";

export interface CustomCaseTypeInput {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly color: number;
  readonly emoji: string;
}

export class CustomCaseTypeRepository {
  constructor(private readonly db: Database) {}

  async create(guildId: string, actorId: string, input: CustomCaseTypeInput): Promise<ModerationCustomCaseType> {
    return this.db.transaction(async (transaction) => {
      await lockGuildTypeNames(transaction, guildId);
      const normalizedName = normalize(input.name);
      const aliases = [...new Set(input.aliases.map(normalize).filter(Boolean))];
      await ensureNamesAvailable(transaction, guildId, [normalizedName, ...aliases]);
      const [created] = await transaction.insert(moderationCustomCaseTypes).values({ guildId, name: input.name.trim(), normalizedName, color: input.color, emoji: input.emoji.trim() }).returning();
      if (!created) throw new Error("Failed to create the custom type.");
      if (aliases.length) await transaction.insert(moderationCustomCaseTypeAliases).values(aliases.map((alias) => ({ guildId, customTypeId: created.id, alias, normalizedAlias: alias })));
      await transaction.insert(moderationAuditEvents).values({ eventType: "case_type.created", guildId, actorId, after: { id: created.id, name: created.name, aliases, color: created.color, emoji: created.emoji } });
      return created;
    });
  }

  async resolve(guildId: string, value: string): Promise<ModerationCustomCaseType | undefined> {
    const [direct] = UUID_PATTERN.test(value) ? await this.db.select().from(moderationCustomCaseTypes).where(and(eq(moderationCustomCaseTypes.guildId, guildId), eq(moderationCustomCaseTypes.id, value), sql`${moderationCustomCaseTypes.deletedAt} IS NULL`)).limit(1) : [];
    if (direct) return direct;
    const normalized = normalize(value);
    const [byName] = await this.db.select().from(moderationCustomCaseTypes).where(and(eq(moderationCustomCaseTypes.guildId, guildId), eq(moderationCustomCaseTypes.normalizedName, normalized), sql`${moderationCustomCaseTypes.deletedAt} IS NULL`)).limit(1);
    if (byName) return byName;
    const [alias] = await this.db.select().from(moderationCustomCaseTypeAliases).where(and(eq(moderationCustomCaseTypeAliases.guildId, guildId), eq(moderationCustomCaseTypeAliases.normalizedAlias, normalized))).limit(1);
    if (!alias) return undefined;
    const [result] = await this.db.select().from(moderationCustomCaseTypes).where(and(eq(moderationCustomCaseTypes.guildId, guildId), eq(moderationCustomCaseTypes.id, alias.customTypeId), sql`${moderationCustomCaseTypes.deletedAt} IS NULL`)).limit(1);
    return result;
  }

  async autocomplete(guildId: string, query: string, limit = 25): Promise<{ name: string; value: string }[]> {
    const pattern = `%${query.trim()}%`;
    const types = await this.db.selectDistinct({ id: moderationCustomCaseTypes.id, name: moderationCustomCaseTypes.name }).from(moderationCustomCaseTypes).leftJoin(moderationCustomCaseTypeAliases, eq(moderationCustomCaseTypeAliases.customTypeId, moderationCustomCaseTypes.id)).where(and(eq(moderationCustomCaseTypes.guildId, guildId), sql`${moderationCustomCaseTypes.deletedAt} IS NULL`, or(ilike(moderationCustomCaseTypes.name, pattern), ilike(moderationCustomCaseTypeAliases.alias, pattern)))).orderBy(asc(moderationCustomCaseTypes.name)).limit(Math.min(limit, 25));
    return types.map((type) => ({ name: type.name, value: type.id }));
  }

  list(guildId: string): Promise<ModerationCustomCaseType[]> {
    return this.db.select().from(moderationCustomCaseTypes).where(and(eq(moderationCustomCaseTypes.guildId, guildId), sql`${moderationCustomCaseTypes.deletedAt} IS NULL`)).orderBy(asc(moderationCustomCaseTypes.name));
  }

  async aliases(guildId: string, typeId: string): Promise<string[]> {
    const rows = await this.db.select({ alias: moderationCustomCaseTypeAliases.alias }).from(moderationCustomCaseTypeAliases).where(and(eq(moderationCustomCaseTypeAliases.guildId, guildId), eq(moderationCustomCaseTypeAliases.customTypeId, typeId))).orderBy(asc(moderationCustomCaseTypeAliases.alias));
    return rows.map((item) => item.alias);
  }

  async update(guildId: string, typeId: string, actorId: string, input: CustomCaseTypeInput): Promise<ModerationCustomCaseType> {
    return this.db.transaction(async (transaction) => {
      await lockGuildTypeNames(transaction, guildId);
      const [current] = await transaction.select().from(moderationCustomCaseTypes).where(and(eq(moderationCustomCaseTypes.guildId, guildId), eq(moderationCustomCaseTypes.id, typeId), sql`${moderationCustomCaseTypes.deletedAt} IS NULL`)).limit(1);
      if (!current) throw new Error("That custom type does not exist.");
      const previousAliases = await transaction.select({ alias: moderationCustomCaseTypeAliases.alias }).from(moderationCustomCaseTypeAliases).where(and(eq(moderationCustomCaseTypeAliases.guildId, guildId), eq(moderationCustomCaseTypeAliases.customTypeId, typeId)));
      const normalizedName = normalize(input.name);
      const aliases = [...new Set(input.aliases.map(normalize).filter(Boolean))];
      await transaction.delete(moderationCustomCaseTypeAliases).where(and(eq(moderationCustomCaseTypeAliases.guildId, guildId), eq(moderationCustomCaseTypeAliases.customTypeId, typeId)));
      await transaction.update(moderationCustomCaseTypes).set({ normalizedName: `editing-${typeId}` }).where(and(eq(moderationCustomCaseTypes.guildId, guildId), eq(moderationCustomCaseTypes.id, typeId)));
      await ensureNamesAvailable(transaction, guildId, [normalizedName, ...aliases]);
      const [updated] = await transaction.update(moderationCustomCaseTypes).set({ name: input.name.trim(), normalizedName, color: input.color, emoji: input.emoji.trim(), updatedAt: new Date() }).where(and(eq(moderationCustomCaseTypes.guildId, guildId), eq(moderationCustomCaseTypes.id, typeId))).returning();
      if (!updated) throw new Error("Failed to update the custom type.");
      if (aliases.length) await transaction.insert(moderationCustomCaseTypeAliases).values(aliases.map((alias) => ({ guildId, customTypeId: typeId, alias, normalizedAlias: alias })));
      await transaction.insert(moderationAuditEvents).values({ eventType: "case_type.edited", guildId, actorId, before: { name: current.name, aliases: previousAliases.map((item) => item.alias), color: current.color, emoji: current.emoji }, after: { name: updated.name, aliases, color: updated.color, emoji: updated.emoji } });
      return updated;
    });
  }

  async delete(guildId: string, typeId: string, actorId: string): Promise<void> {
    const deleted = await this.db.transaction(async (transaction) => {
      await transaction.delete(moderationCustomCaseTypeAliases).where(and(eq(moderationCustomCaseTypeAliases.guildId, guildId), eq(moderationCustomCaseTypeAliases.customTypeId, typeId)));
      const [item] = await transaction.update(moderationCustomCaseTypes).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(moderationCustomCaseTypes.guildId, guildId), eq(moderationCustomCaseTypes.id, typeId))).returning();
      if (item) await transaction.insert(moderationAuditEvents).values({ eventType: "case_type.deleted", guildId, actorId, before: { typeId, name: item.name } });
      return item;
    });
    if (!deleted) throw new Error("That custom type does not exist.");
  }
}

async function ensureNamesAvailable(transaction: DatabaseTransaction, guildId: string, values: string[]): Promise<void> {
  if (!values.length || values.some((value) => !value)) throw new Error("Names and aliases cannot be blank.");
  if (new Set(values).size !== values.length) throw new Error("A custom type name and its aliases must be unique.");
  const names = await transaction.select({ value: moderationCustomCaseTypes.normalizedName }).from(moderationCustomCaseTypes).where(and(eq(moderationCustomCaseTypes.guildId, guildId), inArray(moderationCustomCaseTypes.normalizedName, values), sql`${moderationCustomCaseTypes.deletedAt} IS NULL`));
  const aliases = await transaction.select({ value: moderationCustomCaseTypeAliases.normalizedAlias }).from(moderationCustomCaseTypeAliases).where(and(eq(moderationCustomCaseTypeAliases.guildId, guildId), inArray(moderationCustomCaseTypeAliases.normalizedAlias, values)));
  const duplicate = names[0]?.value ?? aliases[0]?.value;
  if (duplicate) throw new Error(`The name or alias \`${duplicate}\` is already in use in this server.`);
}

async function lockGuildTypeNames(transaction: DatabaseTransaction, guildId: string): Promise<void> {
  await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${guildId}), hashtext('moderation-custom-types'))`);
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
