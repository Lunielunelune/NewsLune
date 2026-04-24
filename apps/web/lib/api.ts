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
  createdAt?: string;
  entities?: Array<{ text: string; type: string }>;
  keywords?: string[];
}

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const emptyNewsResponse = {
  items: [] as Article[],
  nextCursor: null as string | null
};

const emptyCategoriesResponse = {
  items: [] as Array<{ category: string; count: number }>
};

export async function getNews(category?: string) {
  const url = new URL("/news", baseUrl);
  if (category) {
    url.searchParams.set("category", category);
  }

  try {
    const response = await fetch(url, { next: { revalidate: 30 } });
    if (!response.ok) {
      return emptyNewsResponse;
    }
    return response.json() as Promise<{ items: Article[]; nextCursor: string | null }>;
  } catch {
    return emptyNewsResponse;
  }
}

export async function getCategories() {
  try {
    const response = await fetch(`${baseUrl}/categories`, { next: { revalidate: 60 } });
    if (!response.ok) {
      return emptyCategoriesResponse;
    }
    return response.json() as Promise<{ items: Array<{ category: string; count: number }> }>;
  } catch {
    return emptyCategoriesResponse;
  }
}

export async function getArticle(id: string) {
  try {
    const response = await fetch(`${baseUrl}/news/${id}`, { next: { revalidate: 30 } });
    if (!response.ok) {
      return null;
    }
    return response.json() as Promise<Article>;
  } catch {
    return null;
  }
}
