import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Session refresh, and nothing else.
 *
 * In Next.js 16 `middleware.ts` is renamed `proxy.ts` and the export is
 * `proxy`, not `middleware` — Supabase's published SSR guides still say
 * middleware and are wrong for this version. The runtime defaults to Node.js
 * and cannot be configured: setting a `runtime` key here throws.
 *
 * This is deliberately NOT an authorization boundary. The Next docs are
 * explicit that proxy is for optimistic checks only, and there is a sharper
 * reason: Server Actions are POST requests to the route that uses them, so a
 * matcher excluding a path also skips its actions. Every gate therefore lives
 * in the page or action itself — see `requireProfile()` in
 * `lib/supabase/session.ts`.
 *
 * What it does do is give the Supabase client a place where cookies *can* be
 * written. A Server Component render cannot set cookies, so a token that
 * rotates mid-render would otherwise be lost and force a refresh on every
 * subsequent request.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = NextResponse.next({ request });

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }

          // @supabase/ssr hands back no-store headers alongside the cookies.
          // A response carrying Set-Cookie for a session must never be cached
          // by a CDN or reverse proxy, or one user's token gets served to
          // another.
          for (const [key, headerValue] of Object.entries(headers)) {
            response.headers.set(key, headerValue);
          }
        },
      },
    },
  );

  // Must run before the response is generated: a refresh that completes after
  // the response is committed cannot write its cookies, and the next request
  // would refresh all over again.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Without a matcher the proxy runs on every request including static assets,
  // which the Next docs warn can block CSS, JS and images from loading.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
