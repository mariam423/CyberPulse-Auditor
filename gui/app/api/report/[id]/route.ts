/**
 * GET /api/report/[id] — Generate a unified report for a completed run.
 *
 * Query params:
 *   ?format=json|markdown|sarif|html|text   (default: text)
 *   ?download=1                             (Content-Disposition attachment)
 *
 * Byte-identical to `cyberpulse report --run <id> --format <fmt>` — both
 * consume the same unified report service over the shared SQLite core.
 */
import { NextRequest, NextResponse } from 'next/server';
import { RunIdParamSchema } from '@/lib/api-guard';
import { resolve } from 'node:path';
import { getRun } from '@/lib/db';
import { REPORT_FORMATS, FORMAT_META, generateReport, reportFilename } from '@report/service';
import type { ReportFormat } from '@report/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The shared DB lives at <project root>/data/cyberpulse.db — the Next server runs with cwd = gui/. */
function rootDbPath(): string | undefined {
  return process.env.CYBERPULSE_DB_PATH || resolve(process.cwd(), '../data/cyberpulse.db');
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const url = new URL(req.url);
    const rawFormat = (url.searchParams.get('format') ?? 'text').toLowerCase();
    const format = (REPORT_FORMATS as readonly string[]).includes(rawFormat)
      ? (rawFormat as ReportFormat)
      : 'text';
    const download = url.searchParams.get('download') === '1';

    // 404 fast when the run does not exist (same message as the CLI)
    const parsedId = RunIdParamSchema.safeParse(params.id);
    if (!parsedId.success) {
      return NextResponse.json({ error: 'Invalid run id format' }, { status: 400 });
    }
    const run = getRun(parsedId.data);
    if (!run) {
      return NextResponse.json({ error: `Run not found` }, { status: 404 });
    }

    const result = generateReport(parsedId.data, format, rootDbPath());
    if ('error' in result) {
      return NextResponse.json({ error: `Run not found` }, { status: 404 });
    }

    const meta = FORMAT_META[format];
    const headers: Record<string, string> = {
      'Content-Type': meta.contentType,
    };
    if (download) {
      headers['Content-Disposition'] = `attachment; filename="${reportFilename(parsedId.data, format)}"`;
    }

    return new NextResponse(result.content, { status: 200, headers });
  } catch (err) {
    console.error('[api/report/:id] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
