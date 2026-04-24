"use client";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export async function ensureDemoUser() {
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
