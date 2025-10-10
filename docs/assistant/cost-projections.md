# Assistant Cost Projections & Monitoring

## Model Mix
- **Primary**: `gpt-4o-mini` (≈ $0.0006 / 1K prompt tokens, $0.0024 / 1K completion tokens).
- **Fallback**: `gpt-4o` (≈ $0.005 / 1K prompt tokens, $0.015 / 1K completion tokens) invoked only when itinerary context exceeds 6K tokens or classification flags the turn as high-risk (safety or multi-step reasoning).
- **Embedding refresh**: `text-embedding-3-small` (≈ $0.00002 / 1K tokens) for destination content updates, batched nightly.

> Rates sourced from OpenAI pricing (Feb 2025). Update when changing providers or models.

## Baseline Conversation Budget
- Average turn: 1.5K prompt tokens (trip context + instructions) + 300 completion tokens.
- Cost per `gpt-4o-mini` turn ≈ $0.0015.
- Target 10 active conversations per engaged user per day ⇒ ~$0.015 / user / day.
- 1,000 active planners / month ≈ $450 monthly spend (assuming 30 days, 10 turns/day).

### Open Usage Policy
- No hard usage caps are enforced during the rollout; the assistant can serve any number of turns or token volumes permitted by the model provider.
- Monitoring and alerting (below) surface unexpected cost spikes so human operators can intervene manually if needed.

## Fallback & Downgrade Strategy
- If prompt + completion estimate exceeds practical model limits, shift to the summarization template on `gpt-4o-mini-extended` and clearly communicate any truncation.
- Track (but do not throttle) fallback `gpt-4o` usage; log each invocation with `reason=fallback` to inform budgeting.

## Monitoring
- Emit `assistant_cost` metric (tokens_in, tokens_out, model) to logging pipeline per turn.
- Daily cron aggregates spend into Supabase `assistant_telemetry` table (future migration).
- Alert when projected weekly cost exceeds the soft budget threshold (`ASSISTANT_COST_BUDGET_WEEKLY`, default $600) but do not block traffic automatically.

## Future Optimizations
- Introduce retrieval cache for repeated destination lookups to shave ~300 tokens per turn.
- Train lightweight re-ranker to shorten “top 3 suggestions” responses instead of free-form paragraphs.
- Revisit model selection once OpenAI unveils gpt-4.2-mini equivalent—expect 30% savings.
