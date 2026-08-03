# Example result (redacted)

- `sourceStatus`: `live`
- `snapshotAt`: `2026-07-23T03:56:36.504Z`
- `methodologyVersion`: `2026-07-16.1`

| Rank | Name | Listed | Market Quality | Explorer |
| --- | --- | --- | --- | --- |
| 1 | Steakhouse USDG | yes | Strong data (90) | [vault](https://robinhoodchain.blockscout.com/address/0xBeEff033F34C046626B8D0A041844C5d1A5409dd) |
| 2 | Ethena x Steakhouse USDG | no | Standard data (70) | [vault](https://robinhoodchain.blockscout.com/address/0xbEeFF0fb1Dc19344A87b8479dAb60A2e16160737) |

Notes returned to the caller:

- Market Quality is a data-screening score, not a security rating.
- Curator, adapter, collateral, oracle, governance and smart-contract risks are
  outside the score.
- No approvals or deposit calldata were produced.

Exact APY / TVL numbers change with the live Morpho feed; re-query
`https://roven.finance/api/opportunities` for the current snapshot.
