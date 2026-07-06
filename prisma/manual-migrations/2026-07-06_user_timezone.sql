-- Per-user timezone: the viewer's IANA zone, auto-detected from the browser.
-- Drives dashboard date/greeting and today/this-week bucketing so "today"
-- means the user's local day, not the server's (UTC). Additive; idempotent.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "timezone" TEXT;
