# Redacted validation report — partial live proof

## Observed validation

- ACP CLI `1.0.24` was installed and authenticated.
- ACP discovered public devnet wallet `F6vHs4…F6Mo`; public RPC reported `1 SOL`.
- Fresh Compass preflight for a self-recipient `0.0005 SOL` devnet transfer returned exact `allow`.
  - Reason: `TRANSFER_WITHIN_LIMIT_KNOWN_RECIPIENT`
- ACP transfer was attempted once. It returned nonzero with no signature. Public devnet RPC found no new `0.0005 SOL` self-transfer or fee; only the earlier faucet funding transaction appears in recent confirmed history.
- Automated validation passed: 15 focused tests, 31 showcase manifests, public-claim audit, diff check, and secret scan.

## Limitation

This is partial validation of real ACP identity/wallet discovery, real Compass preflight, and fail-closed handling. It is **not** successful transfer proof or hard enforcement. It does not perform post-execution intent matching. The signer completion state must be resolved before another attempt, and any future attempt requires a fresh preflight.

No credential, email, auth response, signer material, private configuration, token, or private prompt is included here.
