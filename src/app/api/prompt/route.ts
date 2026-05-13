import { NextRequest, NextResponse } from 'next/server';
import {
  CopilotClient,
  approveAll,
  type CopilotSession,
  type SessionEvent,
} from '@github/copilot-sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 3600;

type PromptRequest =
  | { prompt: string; reset?: false }
  | { prompt?: string; reset: true };

let clientPromise: Promise<CopilotClient> | null = null;
let sessionPromise: Promise<CopilotSession> | null = null;
let activeCwd: string | null = null;

const resolveCwd = (): string => process.env.COPILOT_WORKING_DIR || process.cwd();

const getClient = async (): Promise<CopilotClient> => {
  if (!clientPromise) {
    const client = new CopilotClient({
      gitHubToken: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
    });
    clientPromise = client.start().then(() => client);
  }
  return clientPromise;
};

const getSession = async (): Promise<CopilotSession> => {
  const cwd = resolveCwd();
  if (sessionPromise && activeCwd === cwd) return sessionPromise;
  if (sessionPromise && activeCwd !== cwd) {
    const prev = await sessionPromise;
    sessionPromise = null;
    activeCwd = null;
    prev.disconnect().catch(() => {});
  }
  if (cwd !== process.cwd()) {
    try {
      process.chdir(cwd);
    } catch (e) {
      throw new Error(
        `COPILOT_WORKING_DIR is set to "${cwd}" but chdir failed: ${(e as Error).message}`
      );
    }
  }
  const client = await getClient();
  activeCwd = cwd;
  sessionPromise = client.createSession({
    streaming: true,
    onPermissionRequest: approveAll,
  });
  return sessionPromise;
};

const resetSession = async () => {
  if (sessionPromise) {
    const s = await sessionPromise.catch(() => null);
    sessionPromise = null;
    activeCwd = null;
    if (s) await s.disconnect().catch(() => {});
  }
};

const summarizeArgs = (args: unknown): string => {
  if (!args || typeof args !== 'object') return '';
  const obj = args as Record<string, unknown>;
  const preferred = ['command', 'cmd', 'path', 'file_path', 'filePath', 'url', 'query', 'pattern'];
  for (const key of preferred) {
    const v = obj[key];
    if (typeof v === 'string') return v.length > 200 ? v.slice(0, 200) + '…' : v;
  }
  try {
    const json = JSON.stringify(obj);
    return json.length > 200 ? json.slice(0, 200) + '…' : json;
  } catch {
    return '';
  }
};

export async function POST(req: NextRequest) {
  let body: PromptRequest;
  try {
    body = (await req.json()) as PromptRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if ('reset' in body && body.reset) {
    await resetSession();
    return NextResponse.json({ ok: true });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  let session: CopilotSession;
  try {
    session = await getSession();
  } catch (e) {
    const message = (e as Error).message || String(e);
    await resetSession().catch(() => {});
    return NextResponse.json(
      {
        error: `Copilot SDK error: ${message}. Ensure @github/copilot CLI is installed and GH_TOKEN (or GITHUB_TOKEN) is set.`,
      },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (payload: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          /* controller closed */
        }
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const unsubscribe = session.on((event: SessionEvent) => {
        switch (event.type) {
          case 'assistant.reasoning_delta':
            send({ type: 'reasoning_delta', text: event.data.deltaContent });
            break;
          case 'assistant.reasoning':
            send({ type: 'reasoning', text: event.data.content });
            break;
          case 'assistant.message_delta':
            send({ type: 'text_delta', text: event.data.deltaContent });
            break;
          case 'assistant.message': {
            const content = event.data.content as unknown;
            let text = '';
            if (typeof content === 'string') {
              text = content;
            } else if (Array.isArray(content)) {
              text = (content as Array<{ type?: string; text?: string }>)
                .filter((c) => c?.type === 'text')
                .map((c) => c.text || '')
                .join('');
            }
            send({ type: 'text', text });
            break;
          }
          case 'tool.execution_start':
            send({
              type: 'tool_start',
              toolCallId: event.data.toolCallId,
              name: event.data.toolName,
              args: summarizeArgs(event.data.arguments),
            });
            break;
          case 'tool.execution_complete': {
            const err = event.data.error;
            send({
              type: 'tool_done',
              toolCallId: event.data.toolCallId,
              error: err ? (err.message || String(err)) : undefined,
            });
            break;
          }
          case 'session.idle':
            send({ type: 'done' });
            finish();
            break;
          default:
            break;
        }
      });

      req.signal.addEventListener('abort', () => {
        session.abort().catch(() => {});
        finish();
      });

      session.send({ prompt }).catch((err: unknown) => {
        send({ type: 'error', message: (err as Error).message || String(err) });
        finish();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
