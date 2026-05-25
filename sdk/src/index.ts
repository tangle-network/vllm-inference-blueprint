export * from "./types";
export {
  SPEND_AUTHORIZATION_TYPE,
  SPEND_AUTH_DOMAIN_NAME,
  SPEND_AUTH_DOMAIN_VERSION,
  buildSpendAuthTypedData,
} from "./eip712";
export {
  createLocalSpendSigner,
  signSpendAuth,
  toSpendAuthPayload,
} from "./spendAuth";
export {
  ERC20_ABI,
  SHIELDED_CREDITS_ABI,
  buildApproveTx,
  buildFundCreditsTx,
  creditIdentityFromKey,
  deriveCommitment,
  generateCreditIdentity,
  type EphemeralCreditIdentity,
} from "./funding";
export { readCreditAccount } from "./account";
export {
  createInferenceClient,
  type ChatStreamHandlers,
  type InferenceClient,
  type StreamChunk,
} from "./client";
