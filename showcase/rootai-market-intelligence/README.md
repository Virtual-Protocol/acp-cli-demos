# rootAI Market Intelligence

rootAI provides graded Hyperliquid signals through ACP.

The live catalog includes:

- `rootai_pro_signals`: paid recent or single-market signals
- `rootai_signals_pass`: 30-day subscription
- `rootai_free_mcp`: public MCP connection details
- `rootai_capabilities`: machine-readable product information

## Provider

- Agent: https://app.virtuals.io/virtuals/92029
- Provider: `0x9d23ddd0a527b3b63927956840c8ff35b9db95a6`
- Network: Base (`8453`)
- Token: `0xe96301023608C61E0191Cd4ced0a5Cd767ed4Da8`

## Requirements

Recent signals:

```json
{"mode":"recent","limit":3,"min_grade":"B"}
```

One market:

```json
{"mode":"by_coin","coin":"BTC"}
```

Optional fields are `asset_class` and `min_grade`. Recent mode returns up to 10 signals. By-coin mode returns one.

## Deliverable

The structured deliverable contains a `signals` array. Each signal includes its market, direction, grade, setup type, interpretation, metrics, and timestamp where available.

The signal engine is deterministic. No private rootAI service code is included in this package.

## Links

- MCP: https://mcp.rootedge.ai/mcp
- MCP Pro: https://mcp.rootedge.ai/pro
- Docs: https://rootai.gitbook.io/docs/mcp/build
- Website: https://rootedge.ai
