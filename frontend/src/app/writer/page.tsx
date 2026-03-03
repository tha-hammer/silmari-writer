'use client';

import { Sparkles, Waves } from 'lucide-react';
import { StartSessionRouteAdapter } from '@/modules/session/StartSessionRouteAdapter';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function WriterPage() {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 py-8 sm:px-6 lg:py-12"
      data-testid="workflow-entry"
    >
      <Card className="relative overflow-hidden border-border/70 bg-card/90 shadow-xl">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/15 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-accent/60 blur-2xl" />

        <CardHeader className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Waves className="h-3.5 w-3.5" />
              Voice Workflow
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              /writer
            </Badge>
          </div>

          <div className="space-y-1">
            <CardTitle className="text-2xl md:text-3xl">Writer Workflow</CardTitle>
            <CardDescription className="text-sm md:text-base">
              Start with a job URL, initialize context, and continue through recall, review, and
              finalization.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 space-y-4">
          <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
            <p>1. Paste URL</p>
            <p>2. Capture evidence</p>
            <p>3. Finalize response</p>
          </div>
          <Separator />
          <StartSessionRouteAdapter />
        </CardContent>
      </Card>
    </main>
  );
}
