// Full-path HTTP e2e: the viem SDK signs a SpendAuth and calls a running
// operator (operator-lite) which validates it (EIP-712 recover + on-chain
// getAccount balance/key check) and proxies the completion to its backend
// (cli-bridge → a real local coding harness). Proves the entire billed
// inference path end to end. Reads ../../.env.local; operator at OPERATOR_API.
//
//   OPERATOR_API=http://127.0.0.1:9100 node sdk/scripts/http-e2e.mjs

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createPublicClient, http, getAddress } from 'viem'

import {
  createInferenceClient,
  createLocalSpendSigner,
} from '../dist/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(resolve(here, '../../.env.local'), 'utf8')
    .split('\n')
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
)

const OPERATOR_API = process.env.OPERATOR_API ?? 'http://127.0.0.1:9100'
const CHAIN_ID = Number(env.CHAIN_ID ?? '31337')

let failed = 0
const assert = (cond, desc, detail = '') =>
  cond
    ? console.log(`  PASS ${desc}`)
    : (failed++, console.error(`  FAIL ${desc} ${detail}`))

const chain = {
  id: CHAIN_ID,
  name: 'anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [env.RPC_URL] } },
}
const publicClient = createPublicClient({ chain, transport: http(env.RPC_URL) })

const client = createInferenceClient({
  operatorUrl: OPERATOR_API,
  shieldedCreditsAddress: getAddress(env.SHIELDED_CREDITS),
  chainId: CHAIN_ID,
  commitment: env.COMMITMENT,
  serviceId: 1n,
  operatorAddress: getAddress(env.OPERATOR_ADDR),
  signer: createLocalSpendSigner(env.USER_KEY),
  model: 'claude-code/sonnet',
  pricePerInputToken: 1n,
  pricePerOutputToken: 2n,
})

async function main() {
  console.log(`[http-e2e] operator=${OPERATOR_API} chain=${CHAIN_ID}`)

  const nonce = await client.syncNonce(publicClient)
  console.log(`[http-e2e] synced spend nonce=${nonce}`)

  console.log('[http-e2e] sending SpendAuth-gated chat (real backend, may take a while)…')
  const res = await client.chat(
    [{ role: 'user', content: 'Reply with exactly one word: hello' }],
    { maxTokens: 64 },
  )

  const content = res?.choices?.[0]?.message?.content ?? ''
  console.log(`[http-e2e] model=${res?.model} content=${JSON.stringify(content)}`)
  console.log(`[http-e2e] usage=${JSON.stringify(res?.usage)}`)

  assert(typeof content === 'string' && content.length > 0, 'completion has content')
  assert((res?.usage?.total_tokens ?? 0) > 0, 'usage reports tokens', `usage=${JSON.stringify(res?.usage)}`)

  // The operator consumed the SpendAuth → on-chain nonce advanced.
  const after = await client.syncNonce(publicClient)
  assert(after === nonce + 1n, 'on-chain spend nonce advanced after the request', `before=${nonce} after=${after}`)

  console.log(failed === 0 ? '\n[http-e2e] ALL PASS' : `\n[http-e2e] ${failed} FAILED`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('[http-e2e] error:', err?.message ?? err)
  process.exit(1)
})
