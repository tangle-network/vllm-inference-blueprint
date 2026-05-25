import {
  encodeFunctionData,
  encodePacked,
  keccak256,
  parseAbi,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";

import type { TxRequest } from "./types";

export const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
]);

export const SHIELDED_CREDITS_ABI = parseAbi([
  "function fundCredits(address token, uint256 amount, bytes32 commitment, address spendingKey)",
  "function getAccount(bytes32 commitment) view returns ((address spendingKey, address token, uint256 balance, uint256 totalFunded, uint256 totalSpent, uint256 nonce))",
  "function withdrawCredits(bytes32 commitment, address recipient, uint256 amount, uint256 nonce, bytes signature)",
]);

/**
 * A freshly generated ephemeral spending key + its derived account commitment.
 * The commitment keys the on-chain credit account; it is bound to the spending
 * key address and a random salt so it cannot be linked to the funder.
 */
export interface EphemeralCreditIdentity {
  spendingKeyPrivate: Hex;
  spendingKey: Address;
  salt: Hex;
  commitment: Hex;
}

/** commitment = keccak256(abi.encodePacked(spendingKey, salt)). */
export function deriveCommitment(spendingKey: Address, salt: Hex): Hex {
  return keccak256(encodePacked(["address", "bytes32"], [spendingKey, salt]));
}

/** Generate a new ephemeral spending key + commitment (random salt). */
export function generateCreditIdentity(): EphemeralCreditIdentity {
  const spendingKeyPrivate = generatePrivateKey();
  const spendingKey = privateKeyToAccount(spendingKeyPrivate).address;
  const salt = generatePrivateKey(); // 32 random bytes, reused as salt
  return {
    spendingKeyPrivate,
    spendingKey,
    salt,
    commitment: deriveCommitment(spendingKey, salt),
  };
}

/** Rebuild a credit identity from a persisted key + salt. */
export function creditIdentityFromKey(
  spendingKeyPrivate: Hex,
  salt: Hex,
): EphemeralCreditIdentity {
  const spendingKey = privateKeyToAccount(spendingKeyPrivate).address;
  return {
    spendingKeyPrivate,
    spendingKey,
    salt,
    commitment: deriveCommitment(spendingKey, salt),
  };
}

/** ERC-20 `approve(shieldedCredits, amount)` transaction. */
export function buildApproveTx(params: {
  token: Address;
  shieldedCreditsAddress: Address;
  amount: bigint;
}): TxRequest {
  return {
    to: params.token,
    data: encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [params.shieldedCreditsAddress, params.amount],
    }),
    value: 0n,
  };
}

/** `fundCredits(token, amount, commitment, spendingKey)` transaction. */
export function buildFundCreditsTx(params: {
  shieldedCreditsAddress: Address;
  token: Address;
  amount: bigint;
  commitment: Hex;
  spendingKey: Address;
}): TxRequest {
  return {
    to: params.shieldedCreditsAddress,
    data: encodeFunctionData({
      abi: SHIELDED_CREDITS_ABI,
      functionName: "fundCredits",
      args: [params.token, params.amount, params.commitment, params.spendingKey],
    }),
    value: 0n,
  };
}
