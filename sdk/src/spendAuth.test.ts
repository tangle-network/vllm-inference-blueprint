import { describe, expect, it } from "vitest";
import {
  concatHex,
  encodeAbiParameters,
  hashTypedData,
  keccak256,
  recoverTypedDataAddress,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { buildSpendAuthTypedData } from "./eip712";
import {
  createLocalSpendSigner,
  signSpendAuth,
  toSpendAuthPayload,
} from "./spendAuth";

const SHIELDED = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as const;
const OPERATOR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
const COMMITMENT =
  "0xe771c63a417fded69ebfad2ca9a2721461e5a1616843d2e3a9807fcbb8f02470" as const;
// anvil key #5
const SPENDING_KEY =
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba" as const;
const CHAIN_ID = 31337;

const baseArgs = {
  chainId: CHAIN_ID,
  shieldedCreditsAddress: SHIELDED,
  commitment: COMMITMENT,
  serviceId: 7n,
  operator: OPERATOR,
  amount: 1_000_000n,
  nonce: 3n,
  expiry: 9_999_999_999n,
} as const;

/**
 * Independently reconstruct the EIP-712 digest exactly as ShieldedCredits.sol
 * and the operator's `recover_spend_auth_signer` do:
 *   digest = keccak256(0x1901 ‖ domainSeparator ‖ structHash)
 * If viem's hashTypedData (what we sign) ever diverges from this, signatures
 * stop recovering to the spending key on-chain — the single worst regression.
 */
function manualDigest(): `0x${string}` {
  const domainTypeHash = keccak256(
    toHex(
      "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
    ),
  );
  const domainSeparator = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
      ],
      [
        domainTypeHash,
        keccak256(toHex("ShieldedCredits")),
        keccak256(toHex("1")),
        BigInt(CHAIN_ID),
        SHIELDED,
      ],
    ),
  );
  const spendTypeHash = keccak256(
    toHex(
      "SpendAuthorization(bytes32 commitment,uint64 serviceId,uint8 jobIndex,uint256 amount,address operator,uint256 nonce,uint64 expiry)",
    ),
  );
  const structHash = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint64" },
        { type: "uint8" },
        { type: "uint256" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint64" },
      ],
      [
        spendTypeHash,
        baseArgs.commitment,
        baseArgs.serviceId,
        0,
        baseArgs.amount,
        baseArgs.operator,
        baseArgs.nonce,
        baseArgs.expiry,
      ],
    ),
  );
  return keccak256(concatHex(["0x1901", domainSeparator, structHash]));
}

describe("SpendAuth EIP-712", () => {
  it("viem typed-data digest matches the contract's hand-computed digest", () => {
    const typedData = buildSpendAuthTypedData({ ...baseArgs, jobIndex: 0 });
    expect(hashTypedData(typedData)).toBe(manualDigest());
  });

  it("local signer's signature recovers to the spending key address", async () => {
    const signer = createLocalSpendSigner(SPENDING_KEY);
    const expected = privateKeyToAccount(SPENDING_KEY).address;
    expect(signer.account).toBe(expected);

    const auth = await signSpendAuth({ signer, ...baseArgs });
    const recovered = await recoverTypedDataAddress({
      ...buildSpendAuthTypedData({ ...baseArgs, jobIndex: 0 }),
      signature: auth.signature,
    });
    expect(recovered).toBe(expected);
  });

  it("emits the operator's camelCase wire payload with string numerics", async () => {
    const signer = createLocalSpendSigner(SPENDING_KEY);
    const auth = await signSpendAuth({ signer, ...baseArgs });
    const payload = toSpendAuthPayload(auth);
    expect(payload).toMatchObject({
      commitment: COMMITMENT,
      serviceId: 7,
      jobIndex: 0,
      amount: "1000000",
      operator: OPERATOR,
      nonce: 3,
      expiry: 9999999999,
    });
    expect(typeof payload.amount).toBe("string");
    expect(payload.signature).toMatch(/^0x[0-9a-f]{130}$/i);
  });
});
