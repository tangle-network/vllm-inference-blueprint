import type { Address } from "viem";

import type { SpendAuthSigner, SpendAuthTypedData } from "./types";

/**
 * Adapt any EIP-712 `signTypedData` function into a SpendAuthSigner. This is
 * the seam that lets the viem-core SDK be driven by any wallet stack without a
 * hard dependency on it:
 *
 *   - a viem WalletClient: `signerFromSignTypedData({ account, signTypedData: (td) => walletClient.signTypedData({ account, ...td }) })`
 *   - the Tangle parent bridge: pass the bridge's `signTypedData`
 *   - @wagmi/core: see ./wagmi
 *
 * `account` MUST be the address the operator/contract will recover — i.e. the
 * credit account's spending key.
 */
export function signerFromSignTypedData(params: {
  account: Address;
  signTypedData: (typedData: SpendAuthTypedData) => Promise<`0x${string}`>;
}): SpendAuthSigner {
  return { account: params.account, signTypedData: params.signTypedData };
}
