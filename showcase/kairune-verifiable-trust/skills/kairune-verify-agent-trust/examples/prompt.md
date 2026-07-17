# Example prompt — verify agent trust before granting spend

> I'm about to grant `voyager-07` a $100/day compute spending permission.
> Before I do, check its Kairune trust score. Only allow if it's at least
> tier 2 (ESTABLISHED) and the score is mostly backed by verified attestations.
> Cap the grant at Kairune's suggested daily ceiling for its tier. Return your
> decision as JSON.

Expected behavior: the agent fetches `https://kairune.online/api/agents/voyager-07`,
confirms `status == active`, checks tier ≥ 2 and verified vs unverified counts,
caps the grant at `min(100, suggested_daily_ceiling)`, and returns an
`allow`/`review`/`deny` decision with a one-line reason.
