"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetch, type HealthResponse } from "@/lib/api";

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkHealth() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<HealthResponse>("/health");
      setHealth(data);
    } catch (err) {
      setHealth(null);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void checkHealth();
  }, []);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Click Up</CardTitle>
          <CardDescription>
            Next.js + shadcn · NestJS + Prisma · Supabase Postgres
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            {loading && <p className="text-muted-foreground">Checking API…</p>}
            {!loading && error && (
              <p className="text-destructive">
                Backend offline: {error}
                <br />
                <span className="text-muted-foreground">
                  Chạy <code>npm run start:dev</code> trong folder backend.
                </span>
              </p>
            )}
            {!loading && health && (
              <ul className="space-y-1">
                <li>
                  API:{" "}
                  <span className="font-medium text-foreground">
                    {health.status}
                  </span>
                </li>
                <li>
                  Database:{" "}
                  <span className="font-medium text-foreground">
                    {health.database}
                  </span>
                </li>
                <li className="text-muted-foreground">{health.timestamp}</li>
              </ul>
            )}
          </div>
          <Button onClick={() => void checkHealth()} disabled={loading}>
            Recheck health
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
