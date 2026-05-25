import { describe, expect, it, vi } from "vitest";

import { createInferenceClient } from "./client";
import { createLocalSpendSigner } from "./spendAuth";
import type { InferenceClientConfig } from "./types";

const SHIELDED = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as const;
const OPERATOR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
const COMMITMENT =
  "0xe771c63a417fded69ebfad2ca9a2721461e5a1616843d2e3a9807fcbb8f02470" as const;
const SPENDING_KEY =
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba" as const;

function makeClient(fetchImpl: typeof fetch) {
  const config: InferenceClientConfig = {
    operatorUrl: "http://operator.local",
    shieldedCreditsAddress: SHIELDED,
    chainId: 31337,
    commitment: COMMITMENT,
    serviceId: 7n,
    operatorAddress: OPERATOR,
    signer: createLocalSpendSigner(SPENDING_KEY),
    pricePerInputToken: 1n,
    pricePerOutputToken: 2n,
    fetchImpl,
  };
  return createInferenceClient(config);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function sseResponse(tokens: string[]): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const t of tokens) {
        c.enqueue(
          enc.encode(
            `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`,
          ),
        );
      }
      c.enqueue(enc.encode("data: [DONE]\n\n"));
      c.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

describe("createInferenceClient", () => {
  it("posts a signed camelCase spend_auth and parses the completion", async () => {
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({
          id: "c1",
          object: "chat.completion",
          created: 1,
          model: "m",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "hi back" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
        }),
      );
    const client = makeClient(fetchSpy);

    const res = await client.chat([{ role: "user", content: "hello" }], {
      maxTokens: 16,
    });
    expect(res.choices[0].message.content).toBe("hi back");

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe("http://operator.local/v1/chat/completions");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.stream).toBe(false);
    // camelCase keys + string numerics, matching the operator's SpendAuthPayload
    expect(body.spend_auth).toMatchObject({
      commitment: COMMITMENT,
      serviceId: 7,
      jobIndex: 0,
      operator: OPERATOR,
      nonce: 0,
    });
    expect(typeof body.spend_auth.amount).toBe("string");
    expect(body.spend_auth.signature).toMatch(/^0x[0-9a-f]{130}$/i);
  });

  it("increments the nonce per request and honors setNonce", async () => {
    // Fresh Response per call — a Response body is single-read.
    const fetchSpy = vi.fn<typeof fetch>().mockImplementation(async () =>
      jsonResponse({
        id: "c",
        object: "chat.completion",
        created: 1,
        model: "m",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "ok" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );
    const client = makeClient(fetchSpy);
    client.setNonce(41n);
    await client.chat([{ role: "user", content: "a" }]);
    await client.chat([{ role: "user", content: "b" }]);
    const n0 = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
      .spend_auth.nonce;
    const n1 = JSON.parse((fetchSpy.mock.calls[1][1] as RequestInit).body as string)
      .spend_auth.nonce;
    expect(n0).toBe(41);
    expect(n1).toBe(42);
    expect(client.getNonce()).toBe(43n);
  });

  it("streams SSE delta tokens and resolves on [DONE]", async () => {
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValue(sseResponse(["Hel", "lo", "!"]));
    const client = makeClient(fetchSpy);

    const tokens: string[] = [];
    const full = await new Promise<string>((resolve, reject) => {
      client.chatStream(
        [{ role: "user", content: "hi" }],
        {
          onToken: (c) => tokens.push(c.token),
          onDone: resolve,
          onError: reject,
        },
        { maxTokens: 8 },
      );
    });
    expect(tokens).toEqual(["Hel", "lo", "!"]);
    expect(full).toBe("Hello!");
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.stream).toBe(true);
  });

  it("surfaces the operator error message on non-2xx (e.g. 402)", async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          error: {
            message: "ShieldedCredits SpendAuth required.",
            type: "billing_error",
            code: "payment_required",
          },
        },
        402,
      ),
    );
    const client = makeClient(fetchSpy);
    await expect(
      client.chat([{ role: "user", content: "x" }]),
    ).rejects.toThrow(/402.*SpendAuth required/);
  });

  it("estimateCost uses per-token prices", () => {
    const client = makeClient(vi.fn<typeof fetch>());
    // 10 input * 1 + 100 output * 2 = 210
    expect(client.estimateCost(10, 100)).toBe(210n);
  });
});
