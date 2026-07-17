# Demo Prompt

Use the Hatcher Virtuals ACP Workbench to prepare a reviewed ACP job draft.

Goal:

- use a Hatcher-managed agent,
- select Virtuals as the inference provider,
- enable Virtuals access,
- search ACP providers for an agent audit or market-research task,
- select one provider offering,
- prepare a draft only,
- and report the provider, offering, maximum budget, requirements, and next approval step.

Suggested task brief:

```text
Find a Virtuals ACP provider that can review an agent launch or perform a short market-research task. Prefer providers with clear offerings and low fixed pricing. Prepare a reviewed ACP job draft, but do not fund or submit the job until an operator approves it.
```

Expected output:

- selected provider name,
- selected offering name,
- max budget,
- requirement payload summary,
- Hatcher job-draft status,
- approval gate before live ACP execution.

Do not include private API keys, wallet private material, OTPs, full access tokens, private prompts, or user account records in the final report.
