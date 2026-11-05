import "server-only";

export function getSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    throw new Error("Set NEXT_PUBLIC_SITE_URL in .env.local.");
  }

  const parsedUrl = new URL(siteUrl);
  if (process.env.NODE_ENV === "production" && parsedUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS in production.");
  }

  return parsedUrl.origin;
}
