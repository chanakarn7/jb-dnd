import { NextResponse } from "next/server";
import os from "node:os";

// Reports the server's LAN address so the DM lobby can show players the real
// join URL (http://<lan-ip>:<port>) — `window.location.origin` would show
// "localhost" when the DM opened the app on the host machine.
export const dynamic = "force-dynamic";

function lanIp(): string | null {
  const candidates: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family === "IPv4" && !ni.internal) candidates.push(ni.address);
    }
  }
  // Prefer common home/private ranges; de-prioritize virtual adapters (Docker/WSL 172.x).
  const rank = (ip: string) =>
    ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3;
  candidates.sort((a, b) => rank(a) - rank(b));
  return candidates[0] ?? null;
}

export function GET() {
  const port = Number(process.env.PORT ?? 3000);
  const host = lanIp();
  return NextResponse.json({ host, port, url: host ? `http://${host}:${port}` : null });
}
