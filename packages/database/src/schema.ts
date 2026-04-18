import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 512 }).notNull(),
    description: text("description"),
    content: text("content"),
    summary: text("summary"),
    source: varchar("source", { length: 128 }).notNull(),
    url: varchar("url", { length: 1024 }).notNull().unique(),
    imageUrl: varchar("image_url", { length: 1024 }),
    category: varchar("category", { length: 64 }).notNull(),
    entities: jsonb("entities").$type<Array<{ text: string; type: string }>>().default([]).notNull(),
    keywords: jsonb("keywords").$type<string[]>().default([]).notNull(),
    rankingScore: integer("ranking_score").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    categoryPublishedIdx: index("articles_category_published_idx").on(table.category, table.publishedAt),
    rankingIdx: index("articles_ranking_idx").on(table.rankingScore)
  })
);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 256 }).notNull().unique(),
  preferences: jsonb("preferences").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.articleId] })
  })
);

