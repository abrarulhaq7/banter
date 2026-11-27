-- The best-first order, after running the same four screenshots through each free model
-- on 2026-11-27. OpenRouter's Nemotron wrote lines as good as Gemini 3.6 Flash, better
-- than Flash-Lite, so it now comes before Flash-Lite. Groq's Qwen was the weakest
-- (wordy, misread text) and stays near the end. Hydrogen and 3.8 Flash were busy or at
-- their daily limit all day and could not be compared; they stay first.
update public.models set rank = 70
  where provider = 'openrouter' and model_id = 'nvidia/nemotron-3.5-super-vl:free';
