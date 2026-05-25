import { signTypedData, sendTransaction } from "@wagmi/core";
import type { Config } from "@wagmi/core";
import type { Address, Hex } from "viem";

import type { SpendAuthSigner, SpendAuthTypedData, TxRequest } from "./types";

/**
 * wagmi integration for the inference SDK. Requires `@wagmi/core` (optional
 * peer dependency) — only import this entry if you use wagmi.
 *
 * Note: in the shielded-credits model, spend authorizations are normally
 * signed by an *ephemeral* key (see `createLocalSpendSigner`), not the
 * connected wallet — so the typical wagmi role is sending the *funding*
 * transactions (`sendFundingTxs`). `wagmiSpendSigner` exists for the
 * alternative mode where the connected wallet itself is the spending key.
 */
export function wagmiSpendSigner(
  config: Config,
  account: Address,
): SpendAuthSigner {
  return {
    account,
    signTypedData: (typedData: SpendAuthTypedData) =>
      signTypedData(config, {
        account,
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message,
      }),
  };
}

/**
 * Send the funding transactions (ERC-20 approve + fundCredits) through the
 * connected wagmi wallet, in order. Returns the transaction hashes.
 */
export async function sendFundingTxs(
  config: Config,
  txs: TxRequest[],
): Promise<Hex[]> {
  const hashes: Hex[] = [];
  for (const tx of txs) {
    const hash = await sendTransaction(config, {
      to: tx.to,
      data: tx.data,
      value: tx.value,
    });
    hashes.push(hash);
  }
  return hashes;
}
