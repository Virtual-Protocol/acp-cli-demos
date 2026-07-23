# Testnet transaction proof

Real on-chain transactions from the Botanary stack on testnet, where the full
`botanary` tier (delegation + AgentGuard) is deployed. Contract deployments and
the end-to-end guarded journey (grant, delegated action, revoke, send, freeze)
were executed on Arbitrum Sepolia; the equity-trade contract set is deployed on
Robinhood Chain testnet; the core set is also on Base Sepolia. Every hash below
resolves on that chain's Blockscout explorer.

## Contract deployments

### Arbitrum Sepolia (chainId 421614) - arbitrum-sepolia.blockscout.com

| Contract | Address | Deploy tx |
| --- | --- | --- |
| AgentGuard | `0x72e167b8C42009FbDF6Bb8ecD211382D671a4d3c` | `0x5c94d465bd4e14e011c39cc3c3d489bfdc0158f406e9225e61a4960cadee6b41` |
| MandateExecutor | `0x33B2A0C7dD3A03c571d78DdeBBe0BD09398ED982` | `0x4e979f0c43a2ccd8cc356121ddd945df76d4a4c0fe2bcfcdd7b3074753632a82` |
| AuditAnchor | `0x42022bBb3094f89C801f545030530b438B82Bac0` | `0xa4bbcff85aff58c98484e0f638de82a22913405410c7ed1b08fad2b0d2326201` |
| AgentGuardFreezePolicy | `0xb70819cBeeDABa2c6Ed5EafDe9B2BCb6DCcDb8c3` | `0x45e6d498764804ad5d4c355db3c03fa942226ada120016c25ecaaba054818f9c` |
| RecipientAllowlistPolicy | `0x79180E7Eb3Ee83b90608D9CebdA2C75603839F35` | `0xa39474a4723f8267fe3577386a81a21c3ae149a1c711510a36a5f1cb98917aa1` |
| MockUSDT | `0xdE2b21e31271de392443f25486618ff1bA40F354` | `0x1f9978b91e1e99ccc80d1c0c3716feaba93a264c4a85373fe21ae85692cf29c5` |

### Base Sepolia (chainId 84532) - base-sepolia.blockscout.com

| Contract | Address | Deploy tx |
| --- | --- | --- |
| AgentGuard | `0xb70819cBeeDABa2c6Ed5EafDe9B2BCb6DCcDb8c3` | `0x6c9ee5f04e4a88e26c5acec23c5abe28964ba54ac5f0c2da5daa77fd54ee6f7b` |
| AgentGuardFreezePolicy | `0x79180E7Eb3Ee83b90608D9CebdA2C75603839F35` | `0xda6dd43ba8e8f8bf32bf6b929e853893fe1c84f94a3178c51778cfa4d9bac34b` |
| AuditAnchor | `0xdE2b21e31271de392443f25486618ff1bA40F354` | `0x9327284a95582ecdbf25447f715fcc10d31dbb2f1c8dbf588b308594d4321c2d` |
| RecipientAllowlistPolicy | `0x42022bBb3094f89C801f545030530b438B82Bac0` | `0xdb6fc3f3098f32af8252467fae99f90f66cbfe2d6b7d930d823ab72acdfcc3d4` |

### Robinhood Chain testnet (chainId 46630) - explorer.testnet.chain.robinhood.com

Includes the tokenized-stock mocks that back the equity-trade venue.

| Contract | Address | Creation tx |
| --- | --- | --- |
| AgentGuard | `0x34F54625d4E7d3D86a21835BF93D1e430644bc5d` | `0xd7cf7968f1d7e0b7c2234d760eee546c76ff03f9f52d1c78de6a38b29bc95289` |
| MandateExecutor | `0x31Ed2eb6872be432922B1EA89bF7AFF240d2e835` | `0x009a1acde69105e27e760d890e88f5c59f4942ecef4639fbcec05d1e888f2928` |
| AuditAnchor | `0xEB5F025e07421BF55Ca7B9efF683C57782227EC2` | `0xe199ddf7c71f5fb3504c68e24970300ec85122d015071ba55d213039e3f3ef3d` |
| MockStock (tokenized equity) | `0xc8f1a2Fd393599EF2c9a0a0cBF46b6D269a199f4` | `0x7df87051b0a8bc88803a28f1c029c2d7679f89e32764891bc0a47c4b0bcda1b2` |
| MockRouter (equity swap venue) | `0x62b4d76cbB8F7823541f2caA432F785133a6CE38` | `0xea10467a67f4c03afb3ae0b49a9d1616ac15fc7feaecbe42c594273784a0218e` |
| USDC | `0x5B6C7cAF7F99f99154fD8375ec935Fcf03F326f5` | `0x45bf87ba380ba9b82f72d6bcc86f92a9dbadf08ec9be74d5c97219ab341e293b` |

## Executed guarded journey (Arbitrum Sepolia)

Driven through the live app by the Botanary test harness on 2026-07-09. Account:
`0x05C25139FDC2Fe2B9f058f15F17eE9893dFBA4e1`. The mandate was armed on-chain
(SmartSession permissionId `0xf2e5f717...a491276`, `isPermissionEnabledOnchain:
true`). Funded from the deployer burner:
`0xf617ef2dd785e519d676c91245fea5448c9d6939dffe12ac2b5430dc6aa3718b` and
`0x6f9d6d3586a91040510b9cee18273b452d3e4394cba9a1a1a86202c298e24c22`.

The account executed **7 UserOperations** in one session (verifiable on
arbitrum-sepolia.blockscout.com). Two used Kernel's owner-lane wrapper
`executeUserOp` (`0x8dd7712f`) - the final send and freeze; five used the
delegated / SmartSession lane `execute` (`0xe9ae5c53`) - the grant/account-deploy,
delegated actions, and revoke.

| # | Time (UTC) | Lane | Phase | Tx |
| --- | --- | --- | --- | --- |
| 1 | 13:20:47 | delegated | grant / account deploy | `0xce4600877edb3abb608ff92912c01fb98f2d3d896e27b4585e7520aa758b38b6` |
| 2 | 13:20:57 | delegated | session install | `0x5ab482e2362f7b97f0b69398492bea0f4b80d68a2c5811faf6b2c9f4111f79d2` |
| 3 | 13:21:02 | delegated | delegated action (in-scope) | `0xa6650e0d808e6dd0214b0e6fa680ebb85bcac235eb6f40d6b125516235c50d86` |
| 4 | 13:21:12 | delegated | delegated action (in-scope) | `0x0be22abaa9b8867c4b2b1145cc328193008416b9e0b73a5129ed89c410d01182` |
| 5 | 13:21:22 | delegated | revoke | `0xcd169bcbd99d3c4534ccf9748eb39b2936619939b0a55fe6e6dcaf13247596ae` |
| 6 | 13:21:32 | owner | send (in-scope) | `0x34cb4e6ae8fe388a6434b4904b986ba638d74eaeb3bffb99a5efa0c1f47c99c2` |
| 7 | 13:21:41 | owner | freeze (kill-switch) | `0x90841d4b6db6ea663e2c13265489061d243210aa9b09176d11e7073829bca7c6` |

An out-of-scope send in the same session was declined at build (`422`, a clean
policy refusal, before signing) and never reached the chain. Rows 1-5 vs 6-7 are
grouped by the on-chain selector (delegated `execute` vs owner `executeUserOp`);
the within-lane phase labels follow the harness's fixed journey order.

The same guardrail decisions are also proven deterministically by the public
88-test suite in `botanary-contracts` (`forge test`), independent of any live run.
No wallet secrets, keys, signatures, or session bearers are published.
