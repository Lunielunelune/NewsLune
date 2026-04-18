export interface Article {
  id: string;
  title: string;
  description?: string | null;
  content?: string | null;
  summary?: string | null;
  source: string;
  url: string;
  imageUrl?: string | null;
  category: string;
  rankingScore: number;
  publishedAt: string;
}

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export async function getNews(category?: string) {
  const url = new URL("/news", baseUrl);
  if (category) {
    url.searchParams.set("category", category);
  }

  const response = await fetch(url, { next: { revalidate: 30 } });
  if (!response.ok) {
    throw new Error("Failed to fetch news");
  }
  return response.json() as Promise<{ items: Article[]; nextCursor: string | null }>;
}

export async function getCategories() {
  const response = await fetch(`${baseUrl}/categories`, { next: { revalidate: 60 } });
  if (!response.ok) {
    throw new Error("Failed to fetch categories");
  }
  return response.json() as Promise<{ items: Array<{ category: string; count: number }> }>;
}

