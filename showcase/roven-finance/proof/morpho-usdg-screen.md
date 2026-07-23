# Morpho → Roven USDG screening proof

## Live workflow

Roven's `/api/opportunities` endpoint reads Morpho Vault V2 data from the
official Morpho GraphQL API (`https://api.morpho.org/graphql`), then applies
the published filters:

- Robinhood Chain mainnet (`4663`)
- Canonical USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`
- Positive net APY
- Morpho-listed **or** at least `$10M` TVL

Market Quality is computed from observable listing / TVL / liquidity / APY
signals and is labeled as a data-screening score, not a security rating.

## Redacted verification

- Live endpoint: <https://roven.finance/api/opportunities>
- Request method: `GET`
- Observed `sourceStatus`: `live`
- Date: `2026-07-23`
- Returned opportunities (addresses public; no keys or personal data):

| Name | Vault | Listed | Notes |
| --- | --- | --- | --- |
| Steakhouse USDG | `0xBeEff033F34C046626B8D0A041844C5d1A5409dd` | yes | Highest Market Quality in the live set |
| Ethena x Steakhouse USDG | `0xbEeFF0fb1Dc19344A87b8479dAb60A2e16160737` | no | Included via `$10M+` TVL rule |

Explorer:

- Steakhouse vault: <https://robinhoodchain.blockscout.com/address/0xBeEff033F34C046626B8D0A041844C5d1A5409dd>
- USDG token: <https://robinhoodchain.blockscout.com/address/0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168>

APY / TVL figures move with the market; re-run `GET /api/opportunities` for the
current snapshot. No API keys, wallet secrets, or private account records are
recorded in this proof.
