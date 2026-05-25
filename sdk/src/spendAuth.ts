import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";

import { buildSpendAuthTypedData } from "./eip712";
import type { SpendAuth, SpendAuthPayload, SpendAuthSigner } from "./types";

/**
 * A local, in-memory SpendAuth signer backed by an ephemeral spending key.
 *
 * In the thin-iframe model this is the common case: the spending key lives
 * client-side, so per-request authorizations are signed locally with zero
 * wallet round-trips. (Funding the account is the only step that touches the
 * user's real wallet — see funding.ts.)
 */
export function createLocalSpendSigner(spendingKeyPrivate: Hex): SpendAuthSigner {
  const account = privateKeyToAccount(spendingKeyPrivate);
  return {
    account: account.address,
    signTypedData: (typedData) => account.signTypedData(typedData),
  };
}

/** Sign a SpendAuthorization with the given signer. */
export async function signSpendAuth(params: {
  signer: SpendAuthSigner;
  chainId: number;
  shieldedCreditsAddress: Address;
  commitment: Hex;
  serviceId: bigint;
  operator: Address;
  amount: bigint;
  nonce: bigint;
  jobIndex?: number;
  expiry: bigint;
}): Promise<SpendAuth> {
  const jobIndex = params.jobIndex ?? 0;
  const typedData = buildSpendAuthTypedData({
    chainId: params.chainId,
    shieldedCreditsAddress: params.shieldedCreditsAddress,
    commitment: params.commitment,
    serviceId: params.serviceId,
    jobIndex,
    amount: params.amount,
    operator: params.operator,
    nonce: params.nonce,
    expiry: params.expiry,
  });
  const signature = await params.signer.signTypedData(typedData);
  return {
    commitment: params.commitment,
    serviceId: params.serviceId,
    jobIndex,
    amount: params.amount,
    operator: params.operator,
    nonce: params.nonce,
    expiry: params.expiry,
    signature,
  };
}

/**
 * Convert a signed SpendAuth into the operator's wire payload (camelCase,
 * bigints as strings). This is what the operator's `SpendAuthPayload`
 * deserializer expects in the body or `X-Payment-Signature` header.
 */
export function toSpendAuthPayload(auth: SpendAuth): SpendAuthPayload {
  return {
    commitment: auth.commitment,
    serviceId: Number(auth.serviceId),
    jobIndex: auth.jobIndex,
    amount: auth.amount.toString(),
    operator: auth.operator,
    nonce: Number(auth.nonce),
    expiry: Number(auth.expiry),
    signature: auth.signature,
  };
}
