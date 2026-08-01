# Demo prompt

```
Migrate my ACP Node provider from the v2 AcpClient onNewTask/onEvaluate
callbacks to the v3 AcpAgent entry-event model.

Constraints:
- package name stays @virtuals-protocol/acp-node-v2
- show phase → event map
- replace FareAmount with AssetToken.usdc
- replace job.deliver/evaluate with session.submit/complete
- run the offline self-check and print the migration map
- do not use real keys or mainnet funds
```
