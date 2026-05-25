import type { Address, Hex, PublicClient } from "viem";

import { SHIELDED_CREDITS_ABI } from "./funding";
import type { CreditAccount } from "./types";

/**
 * Read a credit account's on-chain state. Used to sync the spend nonce and
 * check the remaining balance before authorizing a spend. Mirrors the
 * operator's mandatory `getAccount` check, so the client and operator agree
 * on nonce/balance.
 */
export async function readCreditAccount(
  publicClient: PublicClient,
  shieldedCreditsAddress: Address,
  commitment: Hex,
): Promise<CreditAccount> {
  const view = await publicClient.readContract({
    address: shieldedCreditsAddress,
    abi: SHIELDED_CREDITS_ABI,
    functionName: "getAccount",
    args: [commitment],
  });
  return {
    spendingKey: view.spendingKey,
    token: view.token,
    balance: view.balance,
    totalFunded: view.totalFunded,
    totalSpent: view.totalSpent,
    nonce: view.nonce,
  };
}
