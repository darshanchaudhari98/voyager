"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser client used by the dashboard for reads + realtime subscriptions.
// Uses the public anon key; all writes happen server-side via the service role.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy .env.example to .env.local and fill in your Supabase project values."
    );
  }

  return createBrowserClient(url, anonKey);
}
