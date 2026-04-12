import { ok, withRouteErrorHandling } from "@/lib/server/api";

export async function GET() {
  return withRouteErrorHandling(async () => ok({ status: "ok" }));
}
