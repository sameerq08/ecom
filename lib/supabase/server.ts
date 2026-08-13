import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * The only place a Supabase client is constructed for server code. Components
 * and Server Actions import from here rather than calling `createServerClient`
 * themselves, so the cookie wiring and the key choice exist in exactly one
 * place.
 *
 * A new client per request, never a module-level singleton: the client carries
 * the caller's session, so sharing one across requests would leak a session
 * between users.
 *
 * Only the anon key is ever read here. The service-role key bypasses RLS and
 * has no business in a path a request can reach.
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Server Components cannot write cookies — Next throws if they try.
          // A token refresh landing mid-render is therefore expected to fail
          // here, and is not an error worth surfacing: `proxy.ts` refreshes on
          // every request and is what actually persists rotated tokens.
          // Swallowing this is only safe *because* the proxy exists.
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Deliberately empty. See above.
          }
        },
      },
    },
  );
}
