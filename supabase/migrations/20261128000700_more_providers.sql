-- More AI providers (Groq, OpenRouter), more Gemini models, and "best model first".
--
-- Banter tries the best model the user's keys can use first, and moves to the next one by
-- itself when a model hits its limit. Free tiers count their limits per model (Gemini:
-- 20 a day on the newest models, 500 on Flash-Lite), so one key can go down the list.

-- The two new providers.
alter table public.models drop constraint models_provider_check;
alter table public.models add constraint models_provider_check
  check (provider in ('gemini', 'groq', 'openrouter', 'openai', 'claude'));
alter table public.api_keys drop constraint api_keys_provider_check;
alter table public.api_keys add constraint api_keys_provider_check
  check (provider in ('gemini', 'groq', 'openrouter', 'openai', 'claude'));
alter table public.interactions drop constraint interactions_provider_check;
alter table public.interactions add constraint interactions_provider_check
  check (provider in ('gemini', 'groq', 'openrouter', 'openai', 'claude'));

-- Which model is better, across all providers. Edited in the dashboard to change the order.
alter table public.models add column rank smallint check (rank > 0);
comment on column public.models.rank is
  'Quality order across all providers: 1 is the best. Banter tries the best model a key can use first. Null goes last.';

-- Models that hit their limit, per key, so the next request skips them for a while.
alter table public.api_keys add column model_limits jsonb not null default '{}'::jsonb
  check (jsonb_typeof(model_limits) = 'object');
comment on column public.api_keys.model_limits is
  'Models of this key that hit their limit, and until when to leave them alone: {"model id": "ISO time"}.';

-- A key with no model now means automatic: every model of its provider, best first.
comment on column public.api_keys.model is
  'One model to use with this key, or null for automatic: the best model first, then the next.';

-- Checked against each provider on 2026-11-26: all accept an image and a JSON schema.
-- Gemini's four are the ones its free tier allows. Groq's Llama 4 models were shut down.
-- OpenRouter's are its free models that read images and keep to a schema.
insert into public.models (provider, model_id, label, is_default, sort_order, rank)
values
  ('gemini', 'gemini-3.8-flash', 'Gemini 3.8 Flash', false, 3, 50),
  ('gemini', 'gemini-3.6-flash', 'Gemini 3.6 Flash', false, 4, 60),
  ('groq', 'qwen/qwen3.8-27b', 'Qwen 3.8 27B', true, 1, 90),
  ('openrouter', 'nvidia/nemotron-3.5-super-vl:free', 'Nemotron 3.5 Super VL (free)', true, 1, 100),
  ('openrouter', 'inclusionai/ling-3.2-flash:free', 'Ling 3.2 Flash (free)', false, 2, 110)
on conflict (provider, model_id) do update set rank = excluded.rank;

update public.models set rank = 10 where provider = 'claude' and model_id = 'claude-opus-5-5';
update public.models set rank = 20 where provider = 'claude' and model_id = 'claude-sonnet-5-5';
update public.models set rank = 30 where provider = 'gemini' and model_id = 'gemini-4-hydrogen';
update public.models set rank = 40 where provider = 'openai' and model_id = 'gpt-6-luna';
update public.models set rank = 55 where provider = 'claude' and model_id = 'claude-haiku-5-5';
update public.models set rank = 80 where provider = 'gemini' and model_id = 'gemini-3.5-flash-lite';
