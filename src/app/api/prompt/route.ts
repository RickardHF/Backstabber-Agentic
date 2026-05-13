import { NextRequest, NextResponse } from 'next/server';
import {
  CopilotClient,
  approveAll,
  type CopilotSession,
} from '@github/copilot-sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  try {
    const session = await getSession();
    const result = await session.sendAndWait({ prompt });
    const response = result?.data?.content ?? '(no response)';
    return NextResponse.json({ response, cwd: activeCwd });
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
}
