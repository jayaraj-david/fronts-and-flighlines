// Password gate for the whole site (Vercel Routing Middleware, works on the free plan).
// Set SITE_PASSWORD (and optionally SITE_USER) in Vercel: Project > Settings > Environment Variables.
export const config = { matcher: "/(.*)" };

export default function middleware(request) {
  const user = process.env.SITE_USER || "jayaraj";
  const pass = process.env.SITE_PASSWORD;
  if (!pass) return; // no password set: site stays open
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Basic ")) {
    try {
      const [u, p] = atob(auth.slice(6)).split(":");
      if (u === user && p === pass) return; // correct: let the request through
    } catch (e) {}
  }
  return new Response("Private site. Sign in to continue.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Fronts and Flightlines", charset="UTF-8"', "Cache-Control": "no-store" },
  });
}
