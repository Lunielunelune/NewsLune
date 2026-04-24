"use client";

import { useState } from "react";

interface BookmarkButtonProps {
  articleId: string;
  className?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

async function ensureDemoUser() {
  const existingUserId = window.localStorage.getItem("demo-user-id");
  if (existingUserId) {
    return existingUserId;
  }

  const email = `demo-${crypto.randomUUID()}@aperture.local`;

  try {
    const response = await fetch(`${baseUrl}/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, preferences: { mode: "demo" } })
    });

    if (!response.ok) {
      throw new Error("Failed to create demo user");
    }

    const user = (await response.json()) as { id: string };
    window.localStorage.setItem("demo-user-id", user.id);
    return user.id;
  } catch {
    const fallbackId = crypto.randomUUID();
    window.localStorage.setItem("demo-user-id", fallbackId);
    return fallbackId;
  }
}

export function BookmarkButton({ articleId, className }: BookmarkButtonProps) {
  const [saved, setSaved] = useState(false);

  async function saveBookmark() {
    const userId = await ensureDemoUser();

    await fetch(`${baseUrl}/bookmark`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, articleId })
    });

    setSaved(true);
  }

  return (
    <button className={className} onClick={() => void saveBookmark()}>
      {saved ? "Saved" : "Bookmark"}
    </button>
  );
}
