import { describe, expect, it } from "vitest";
import { decodeFunctionData } from "viem";

import {
  ERC20_ABI,
  SHIELDED_CREDITS_ABI,
  buildApproveTx,
  buildFundCreditsTx,
  creditIdentityFromKey,
  deriveCommitment,
  generateCreditIdentity,
} from "./funding";

const TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;
const SHIELDED = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as const;
const KEY =
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba" as const;
const SALT =
  "0x1111111111111111111111111111111111111111111111111111111111111111" as const;

describe("funding", () => {
  it("deriveCommitment is deterministic for a (key, salt) pair", () => {
    const id = creditIdentityFromKey(KEY, SALT);
    expect(id.commitment).toBe(deriveCommitment(id.spendingKey, SALT));
    // stable across calls
    expect(creditIdentityFromKey(KEY, SALT).commitment).toBe(id.commitment);
  });

  it("generateCreditIdentity produces a self-consistent identity", () => {
    const id = generateCreditIdentity();
    expect(id.spendingKeyPrivate).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(id.commitment).toBe(deriveCommitment(id.spendingKey, id.salt));
    // two generations must differ
    expect(generateCreditIdentity().commitment).not.toBe(id.commitment);
  });

  it("buildApproveTx encodes approve(shieldedCredits, amount)", () => {
    const tx = buildApproveTx({
      token: TOKEN,
      shieldedCreditsAddress: SHIELDED,
      amount: 500n,
    });
    expect(tx.to).toBe(TOKEN);
    expect(tx.value).toBe(0n);
    const decoded = decodeFunctionData({ abi: ERC20_ABI, data: tx.data });
    expect(decoded.functionName).toBe("approve");
    expect(decoded.args).toEqual([SHIELDED, 500n]);
  });

  it("buildFundCreditsTx encodes fundCredits(token, amount, commitment, spendingKey)", () => {
    const id = creditIdentityFromKey(KEY, SALT);
    const tx = buildFundCreditsTx({
      shieldedCreditsAddress: SHIELDED,
      token: TOKEN,
      amount: 1000n,
      commitment: id.commitment,
      spendingKey: id.spendingKey,
    });
    expect(tx.to).toBe(SHIELDED);
    const decoded = decodeFunctionData({
      abi: SHIELDED_CREDITS_ABI,
      data: tx.data,
    });
    expect(decoded.functionName).toBe("fundCredits");
    expect(decoded.args).toEqual([TOKEN, 1000n, id.commitment, id.spendingKey]);
  });
});
