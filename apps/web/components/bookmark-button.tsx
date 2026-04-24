"use client";

import { useState } from "react";
import { ensureDemoUser } from "../lib/demo-user";

interface BookmarkButtonProps {
  articleId: string;
  className?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

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
