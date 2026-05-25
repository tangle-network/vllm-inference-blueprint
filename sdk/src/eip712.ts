import type { Address, Hex } from "viem";

import type { SpendAuthTypedData } from "./types";

/**
 * Canonical EIP-712 definitions for ShieldedCredits SpendAuthorization.
 *
 * These MUST stay byte-identical to:
 *   - `ShieldedCredits.SPEND_TYPEHASH` / `DOMAIN_SEPARATOR`
 *     (shielded-payment-gateway/src/shielded/ShieldedCredits.sol)
 *   - the operator's `recover_spend_auth_signer`
 *     (tangle-inference-core/src/billing.rs)
 *
 * Domain: name="ShieldedCredits", version="1", chainId=<runtime>,
 * verifyingContract=<ShieldedCredits address>. The struct field ORDER and
 * Solidity types are load-bearing — the on-chain `keccak256(abi.encode(...))`
 * depends on them exactly.
 */
export const SPEND_AUTH_DOMAIN_NAME = "ShieldedCredits" as const;
export const SPEND_AUTH_DOMAIN_VERSION = "1" as const;

export const SPEND_AUTHORIZATION_TYPE = [
  { name: "commitment", type: "bytes32" },
  { name: "serviceId", type: "uint64" },
  { name: "jobIndex", type: "uint8" },
  { name: "amount", type: "uint256" },
  { name: "operator", type: "address" },
  { name: "nonce", type: "uint256" },
  { name: "expiry", type: "uint64" },
] as const;

/** Build the EIP-712 typed-data bundle for a SpendAuthorization. */
export function buildSpendAuthTypedData(params: {
  chainId: number;
  shieldedCreditsAddress: Address;
  commitment: Hex;
  serviceId: bigint;
  jobIndex: number;
  amount: bigint;
  operator: Address;
  nonce: bigint;
  expiry: bigint;
}): SpendAuthTypedData {
  return {
    domain: {
      name: SPEND_AUTH_DOMAIN_NAME,
      version: SPEND_AUTH_DOMAIN_VERSION,
      chainId: params.chainId,
      verifyingContract: params.shieldedCreditsAddress,
    },
    types: {
      SpendAuthorization: SPEND_AUTHORIZATION_TYPE.map((f) => ({ ...f })),
    },
    primaryType: "SpendAuthorization",
    message: {
      commitment: params.commitment,
      serviceId: params.serviceId,
      jobIndex: params.jobIndex,
      amount: params.amount,
      operator: params.operator,
      nonce: params.nonce,
      expiry: params.expiry,
    },
  };
}
