// Completes a full-page OAuth redirect: the broker sends the browser back to
// our origin with tokens in the URL hash (or query). Nothing else in the app
// reads them, so without this the user lands back signed out.

export type OAuthReturn =
  | { tokens: { access_token: string; refresh_token: string }; error?: undefined }
  | { tokens?: undefined; error: string };

function read(params: URLSearchParams): OAuthReturn | null {
  const error = params.get("error_description") ?? params.get("error");
  if (error) return { error };
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (access_token && refresh_token) return { tokens: { access_token, refresh_token } };
  return null;
}

/** Reads tokens from the current URL and strips them from the address bar. */
export function consumeOAuthReturn(): OAuthReturn | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.startsWith("#")
    ? new URLSearchParams(window.location.hash.slice(1))
    : new URLSearchParams();
  const result = read(hash) ?? read(new URLSearchParams(window.location.search));
  if (result) {
    window.history.replaceState({}, "", window.location.pathname);
  }
  return result;
}
