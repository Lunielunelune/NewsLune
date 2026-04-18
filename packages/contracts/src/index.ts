import { z } from "zod";

export const topics = {
  rawNews: "raw_news",
  processedNews: "processed_news",
  dedupedNews: "deduped_news",
  enrichedNews: "enriched_news",
  notifications: "notifications",
  processingDlq: "processed_news_dlq",
  dedupeDlq: "deduped_news_dlq",
  enrichmentDlq: "enriched_news_dlq",
  rankingDlq: "ranking_news_dlq"
} as const;

export const articleCategories = [
  "World",
  "Politics",
  "Business",
  "Technology",
  "Science",
  "Health",
  "Sports",
  "Entertainment"
] as const;

export const rawNewsEventSchema = z.object({
  id: z.string(),
  source: z.string(),
  title: z.string(),
  description: z.string().optional(),
  content: z.string().optional(),
  url: z.string().url(),
  imageUrl: z.string().url().optional(),
  publishedAt: z.string(),
  ingestedAt: z.string(),
  metadata: z.record(z.any()).default({})
});

export const processedNewsEventSchema = rawNewsEventSchema.extend({
  normalizedTitle: z.string(),
  normalizedContent: z.string(),
  urlHash: z.string(),
  language: z.string().default("en")
});

export const dedupedNewsEventSchema = processedNewsEventSchema.extend({
  canonicalId: z.string(),
  similarityScore: z.number().min(0).max(1),
  duplicate: z.boolean().default(false)
});

export const enrichedNewsEventSchema = dedupedNewsEventSchema.extend({
  category: z.enum(articleCategories),
  entities: z.array(
    z.object({
      text: z.string(),
      type: z.string()
    })
  ),
  summary: z.string(),
  sentiment: z.number().min(-1).max(1),
  keywords: z.array(z.string())
});

export type RawNewsEvent = z.infer<typeof rawNewsEventSchema>;
export type ProcessedNewsEvent = z.infer<typeof processedNewsEventSchema>;
export type DedupedNewsEvent = z.infer<typeof dedupedNewsEventSchema>;
export type EnrichedNewsEvent = z.infer<typeof enrichedNewsEventSchema>;

export interface RankingFactors {
  recencyScore: number;
  popularityScore: number;
  sourceQualityScore: number;
}

export interface RankedArticle extends EnrichedNewsEvent {
  rankingScore: number;
  rankingFactors: RankingFactors;
}
