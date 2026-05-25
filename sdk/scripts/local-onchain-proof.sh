#!/usr/bin/env bash
# Deploy the real ShieldedCredits + a mock token against a running anvil, fund a
# credit account, then run the viem SDK on-chain proof (onchain-e2e.mjs).
#
# Prereqs: anvil already running at $RPC_URL (chain 31337); foundry; node.
#   GATEWAY_DIR defaults to ~/code/shielded-payment-gateway (home of
#   ShieldedCredits.sol + test/MockERC20.sol).
#
#   RPC_URL=http://127.0.0.1:8645 bash sdk/scripts/local-onchain-proof.sh
set -uo pipefail

RPC_URL="${RPC_URL:-http://127.0.0.1:8645}"
CHAIN_ID="${CHAIN_ID:-31337}"
GATEWAY_DIR="${GATEWAY_DIR:-$HOME/code/shielded-payment-gateway}"
SDK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_OUT="$(cd "$SDK_DIR/.." && pwd)/.env.local"

# anvil default accounts
DEPLOYER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
OPERATOR_ADDR=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
USER_KEY=0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba
USER_ADDR=0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc   # == address(USER_KEY) == spendingKey
FUND_AMOUNT=1000000000000000000000                      # 1000 tokens

addr_from() { echo "$1" | grep -i "Deployed to:" | awk '{print $3}'; }

echo "[proof] deploying MockERC20 + ShieldedCredits from $GATEWAY_DIR against $RPC_URL"
cd "$GATEWAY_DIR"

TOKEN=$(addr_from "$(forge create test/MockERC20.sol:MockERC20 \
  --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY" --root "$GATEWAY_DIR" --broadcast 2>&1)")
[ -n "$TOKEN" ] || { echo "ERROR: MockERC20 deploy failed"; exit 1; }
echo "[proof] token=$TOKEN"

CREDITS=$(addr_from "$(forge create src/shielded/ShieldedCredits.sol:ShieldedCredits \
  --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY" --root "$GATEWAY_DIR" --broadcast 2>&1)")
[ -n "$CREDITS" ] || { echo "ERROR: ShieldedCredits deploy failed"; exit 1; }
echo "[proof] shielded_credits=$CREDITS"

COMMITMENT=$(cast keccak "$(cast abi-encode 'f(address,bytes32)' "$USER_ADDR" \
  0x1111111111111111111111111111111111111111111111111111111111111111)")
echo "[proof] commitment=$COMMITMENT"

echo "[proof] mint + approve + fundCredits (spendingKey=$USER_ADDR)"
cast send "$TOKEN" "mint(address,uint256)" "$USER_ADDR" "$FUND_AMOUNT" \
  --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY" >/dev/null || exit 1
cast send "$TOKEN" "approve(address,uint256)" "$CREDITS" "$FUND_AMOUNT" \
  --rpc-url "$RPC_URL" --private-key "$USER_KEY" >/dev/null || exit 1
cast send "$CREDITS" "fundCredits(address,uint256,bytes32,address)" \
  "$TOKEN" "$FUND_AMOUNT" "$COMMITMENT" "$USER_ADDR" \
  --rpc-url "$RPC_URL" --private-key "$USER_KEY" >/dev/null || exit 1

cat > "$ENV_OUT" <<EOF
RPC_URL=$RPC_URL
CHAIN_ID=$CHAIN_ID
SHIELDED_CREDITS=$CREDITS
TOKEN_ADDR=$TOKEN
OPERATOR_ADDR=$OPERATOR_ADDR
DEPLOYER_KEY=$DEPLOYER_KEY
USER_KEY=$USER_KEY
SPENDING_KEY=$USER_ADDR
COMMITMENT=$COMMITMENT
CREDIT_FUND_AMOUNT=$FUND_AMOUNT
EOF
echo "[proof] wrote $ENV_OUT"

echo "[proof] === running SDK on-chain e2e ==="
node "$SDK_DIR/scripts/onchain-e2e.mjs"
