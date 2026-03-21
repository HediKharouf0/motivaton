.PHONY: install build build-contracts build-miniapp dev dev-backend dev-miniapp deploy typecheck clean

# Install all dependencies
install:
	pnpm install

# Build everything
build: build-contracts build-miniapp

# Compile the Tact smart contract
build-contracts:
	pnpm --filter motivaton-contracts build

# Build the miniapp for production
build-miniapp:
	pnpm --filter motivaton-miniapp build

# Run backend dev server (port 3001)
dev-backend:
	pnpm --filter motivaton-backend dev

# Run miniapp dev server (port 5173)
dev-miniapp:
	pnpm --filter motivaton-miniapp dev

# Run both backend and miniapp in parallel
dev:
	@echo "Starting backend and miniapp..."
	@pnpm --filter motivaton-backend dev & pnpm --filter motivaton-miniapp dev

# Deploy the ProductivityEscrow contract to TON testnet
# Required env vars:
#   DEPLOY_MNEMONIC       - 24-word wallet mnemonic
#   VERIFIER_PUBLIC_KEY   - hex ed25519 public key (from: make verifier-keygen)
#   TON_API_KEY           - toncenter.com API key (optional but recommended)
#   TON_ENDPOINT          - RPC endpoint (defaults to testnet)
deploy: build-contracts
	pnpm --filter motivaton-contracts run deploy:contract

# Generate a new ed25519 keypair for the backend verifier
# Prints the secret key (for VERIFIER_SECRET_KEY) and public key (for VERIFIER_PUBLIC_KEY)
verifier-keygen:
	pnpm --filter motivaton-contracts keygen

# Type-check frontend and backend
typecheck:
	pnpm typecheck

# Clean build artifacts
clean:
	pnpm --filter motivaton-contracts clean
	rm -rf apps/miniapp/dist
	rm -rf apps/backend/dist
