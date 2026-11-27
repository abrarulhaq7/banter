import { AI_WORDS } from './default-prompts';
import { MAX_LINES } from './schema';
import type {
  Adjustment,
  BuiltPrompt,
  ContextId,
  Direction,
  LineFeedback,
  MemoryItem,
  PromptInput,
  SenderProfile,
} from './types';

/**
 * Assembles the prompt from its layers, in the order of PLAN.md section 6.
 *
 * The fixed parts (core rules, output format) go in the system prompt. The parts a user
 * can edit (mode instruction, tone) go in the message with the screenshot, clearly
 * labelled, so an edit can change the style of the lines but not the rules or the format.
 */

const CONTEXT: Record<ContextId, string> = {
  stranger: 'They have never talked. She does not know the sender.',
  mutual_follow: 'They follow each other on Instagram but have not really talked.',
  know_her: 'They know each other in real life.',
  already_talking: 'They are already in a conversation.',
};

/** How they know each other, in a few words, for the list of people with notes. */
const CONTEXT_SHORT: Record<ContextId, string> = {
  stranger: 'they have never talked',
  mutual_follow: 'they follow each other but have not really talked',
  know_her: 'they know each other in real life',
  already_talking: 'they are already talking',
};

/** How many people with notes go in a prompt, and how much of each note. */
export const NOTED_PEOPLE_MAX = 20;
export const NOTED_NOTE_MAX = 300;

/** The longest focus a request carries ("her nails", "the café"), and how many it may carry. */
export const FOCUS_MAX = 60;
export const FOCUSES_MAX = 3;
/** A set with a focus: how many lines in all, and how many of them are about the focus. */
export const FOCUSED_SET_LINES = 5;
export const FOCUS_LINES = 3;

/** One focus as it goes into a request: one line, no quotes, not too long. Null when empty. */
export function cleanFocus(focus: string | null | undefined): string | null {
  const clean = (focus ?? '')
    .replace(/["“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, FOCUS_MAX)
    .trim();
  return clean || null;
}

/** The focuses of a request, each cleaned: no blanks, no repeats, at most three. */
export function cleanFocuses(focuses: readonly (string | null | undefined)[] | null | undefined): string[] {
  const kept: string[] = [];
  for (const focus of focuses ?? []) {
    const clean = cleanFocus(focus);
    if (clean && !kept.some((item) => item.toLowerCase() === clean.toLowerCase())) kept.push(clean);
    if (kept.length === FOCUSES_MAX) break;
  }
  return kept;
}

/** "her nails", "her nails and her hair", "her nails, her hair and the gym". */
export function focusList(focuses: readonly string[]): string {
  if (focuses.length <= 1) return focuses[0] ?? '';
  return `${focuses.slice(0, -1).join(', ')} and ${focuses[focuses.length - 1]}`;
}

/** How many lines a request asks for: five with a focus (three of them about it), else three. */
export function linesWanted(input: Pick<PromptInput, 'mode' | 'focus'>): number {
  return input.mode !== 'analyse' && cleanFocuses(input.focus).length > 0 ? FOCUSED_SET_LINES : MAX_LINES;
}

/** How lines 1 to 3 share out between one, two or three focuses. */
function focusSplit(focuses: string[], what: string): string {
  if (focuses.length === 1) {
    return `Lines 1 to 3 are about ${what}. Hook each one to it, each from a different angle and with a different move.`;
  }
  if (focuses.length === 2) {
    return `Lines 1 to 3 are about ${what}: at least one line about each, hooked to it, each with a different move.`;
  }
  return `Lines 1 to 3 are one about each, in this order: ${what}. Hook each one to it, each with a different move.`;
}

/**
 * What a focus asks for. It comes after everything else that shapes the lines (tone,
 * direction, adjustments), so the number of lines it sets is the last word, and it says
 * outright that no focus can break a rule: a stranger still gets nothing about her looks.
 */
function focusText(focuses: string[]): string {
  const what = focusList(focuses.map((focus) => `"${focus}"`));
  return `He wants lines about ${what}. Whatever the sections above say about how many lines to write, write five this time:
- ${focusSplit(focuses, what)} If you cannot see one in the screenshot, take it as a topic he wants to bring up.
- Lines 4 and 5 are your own picks: other things in the screenshot, as you would choose without a focus.
Everything above holds for all five lines: the tone, how they know each other and every rule. The focus never overrides a rule. If the rules do not allow comments on her looks with this person, clothes and accessories are fine only as her choice or a find, and her face, hair, makeup and body are off limits even when they are the focus: then its lines are about something connected to it that the rules allow (a caption or song about it, the place, the moment, what she is doing), never about the thing itself.`;
}

const BOLDNESS_FROM_NOTE =
  'bolder when it says she flirts back or they are close, lighter when it says she keeps things friendly';

const ADJUSTMENT: Record<Adjustment, string> = {
  new_lines:
    'The sender did not pick any of these. Write three new lines that hook to different details or take a different angle.',
  shorter: 'The sender wants shorter versions. Write three lines in the same spirit, each clearly shorter.',
  bolder:
    'The sender wants bolder versions. Write three lines that are more direct and confident, without breaking any rule above.',
};

/** What each "Where to take it" choice asks for. Keep it going is the usual task, so it adds nothing. */
const DIRECTION: Record<Exclude<Direction, 'keep_going'>, { title: string; body: string }> = {
  heat_up: {
    title: 'Where to take it: turn up the heat',
    body: `He wants this chat to get hotter, one step at a time. First judge where it stands now, and say it in "read": is she matching his energy, keeping it light, or cooling off?

Then write three lines that are each one step hotter than the chat is now, each a different move: one turns the topic to the two of them, one teases or dares her, one asks a "what if" question that lets her imagination do the work. Every line leaves her an easy way to match him or to laugh it off.

Go one step, not three: suggestive, not explicit. If she has already gone further herself, you may meet her level. If she is deflecting, slow or cold, do not escalate: say so in "read", and write warm lines that keep the door open instead. This applies only when they know each other or are already talking; with a stranger write warm, clean lines and say in "read" that it is too soon.`,
  },
  ask_out: {
    title: 'Where to take it: ask her out',
    body: `He wants to ask her out. First judge whether the chat is warm enough for it, and say it in "read".

Then write three ways to suggest meeting. Each is specific (a place or a plan, tied to something from the chat or her interests when you can), low-pressure, and easy to say yes to, or to answer with another time. One can be playful, one direct, one casual. If it is clearly too early, say so in "read" and write lines that build towards it instead.`,
  },
};

const FEEDBACK: Record<LineFeedback, string> = {
  too_much: 'too much',
  too_tame: 'too tame',
  cringe: 'cringe',
  not_me: 'not like him',
  too_long: 'too long',
  generic: 'too generic',
};

/** What fixing a marked line asks for. */
const FIX: Record<LineFeedback, string> = {
  too_much: 'Write three lines in the same spirit that are clearly softer: less forward, less heat.',
  too_tame: 'Write three lines that are clearly bolder and more direct, without breaking any rule above.',
  cringe: 'Write three new lines that avoid what made it cringe: no cheesy phrasing, nothing that tries too hard.',
  not_me: 'Write three new lines that sound more like how he texts.',
  too_long: 'Write three lines in the same spirit, each clearly shorter.',
  generic: 'Write three new lines that are more specific: each hooks to something only this screenshot shows.',
};

/** What a run of the same reason on one tone asks the writer to change. */
const CALIBRATION: Record<LineFeedback, string> = {
  too_much: 'keep this tone a notch lower than its description',
  too_tame: 'push this tone a notch further than its description',
  cringe: 'keep it natural, nothing cheesy or try-hard',
  not_me: 'stay closer to how he texts',
  too_long: 'keep the lines shorter',
  generic: 'make every line specific to the screenshot',
};

/** Marks of the same reason needed before a tone is adjusted for it. */
export const CALIBRATION_MIN = 2;

function section(title: string, body: string): string {
  return `## ${title}\n${body.trim()}`;
}

function profileText(profile: SenderProfile): string | null {
  const facts = [
    profile.name ? `Name: ${profile.name}` : null,
    profile.age ? `Age: ${profile.age}` : null,
    profile.city ? `City: ${profile.city}` : null,
    profile.work ? `Work or study: ${profile.work}` : null,
    profile.interests ? `Interests: ${profile.interests}` : null,
    profile.textingStyle ? `How he texts: ${profile.textingStyle}` : null,
    profile.goal ? `What he wants from these chats: ${profile.goal}` : null,
  ].filter((fact): fact is string => fact !== null);

  if (facts.length === 0) return null;
  return `${facts.join('\n')}\n\nUse a fact only when it genuinely helps a line. Most lines should not mention the sender at all. Write the way he texts.`;
}

function memoryText(memory: MemoryItem[]): string {
  const items = memory.slice(0, 5).map((item) => {
    if (item.sameScreenshot) {
      // Other sets for the screenshot in front of the model. He is still choosing: a copied
      // line here is not a message she has had time to answer.
      const heading = ['Just now, for this same screenshot', item.modeLabel, item.toneLabel].filter(Boolean).join(', ');
      return [heading, ...item.lines.map((line) => `- "${line.text}" (already offered)`)].join('\n');
    }
    const heading = [item.at.slice(0, 10), item.modeLabel, item.toneLabel].filter(Boolean).join(', ');
    const lines = item.lines.map((line) => {
      const outcome = !line.copied
        ? 'not sent'
        : line.result === 'replied'
          ? 'sent, she replied'
          : line.result === 'no_reply'
            ? 'sent, no reply'
            : line.awaitingReply
              ? 'sent, waiting for a reply'
              : 'sent';
      return `- "${line.text}" (${outcome})`;
    });
    return [heading, ...lines].join('\n');
  });
  return `${items.join('\n\n')}\n\nDo not repeat these lines or their hooks. You may refer back to something that was sent. Only a line marked "sent, no reply" went unanswered: then do not chase it, and write lines that stand on their own. "Sent, waiting for a reply" and "already offered" are not silence.`;
}

/**
 * A short checklist at the very end of the request. Smaller models follow what they read
 * last best, and these are the rules they slipped on in testing (2026-11-27). It comes from
 * the app's code, so it holds whatever the editable prompts say.
 */
function finalCheck(input: PromptInput): string {
  const looks =
    input.context === 'know_her' || input.context === 'already_talking'
      ? null
      : '- Nothing about her face, hair, makeup, body, expression or pose: they do not know each other well enough.';
  const focuses = cleanFocuses(input.focus);
  const what = focusList(focuses.map((focus) => `"${focus}"`));
  return [
    '- Each line hooks to something you can really see, and makes sense at once.',
    focuses.length > 0
      ? `- Five lines: 1 to 3 about ${what}${focuses.length > 1 ? ', each of them at least once' : ''}, 4 and 5 your own picks about other things. Each uses a move that fits the tone, and lines 1 to 3 use three different moves.`
      : '- Each line uses a move that fits the tone, and the three moves are different.',
    `- No line uses any of these words: ${AI_WORDS.join(', ')}.`,
    looks,
    looks && focuses.length === 1
      ? `- The focus does not lift that: if ${what} is her face, hair, makeup or body, lines 1 to 3 are about what is around it instead, and say nothing about the thing itself.`
      : null,
    looks && focuses.length > 1
      ? `- The focus does not lift that: any of ${what} that is her face, hair, makeup or body gets lines about what is around it instead, never about the thing itself.`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildPrompt(input: PromptInput): BuiltPrompt {
  const system = [input.core.rules.trim(), section('Answer format', input.core.outputFormat)].join('\n\n');

  const parts: string[] = [section('Task', input.modeInstruction)];

  if (input.tone && input.mode !== 'analyse') {
    const marks = (input.toneMarks ?? []).filter((mark) => mark.count >= CALIBRATION_MIN);
    const calibration =
      marks.length > 0
        ? `\n\nLately he marked lines in this tone as ${marks.map((mark) => `${FEEDBACK[mark.reason]} (${mark.count} times)`).join(', ')}. So: ${marks.map((mark) => CALIBRATION[mark.reason]).join('; ')}.`
        : '';
    parts.push(section(`Tone: ${input.tone.label}`, `${input.tone.definition}${calibration}`));
  }
  if (input.context) {
    parts.push(section('How they know each other', CONTEXT[input.context]));
  }
  const aboutHer = input.aboutHer?.trim();
  if (aboutHer) {
    parts.push(
      section(
        'What the sender says about her',
        `${aboutHer}\n\nUse this to judge how bold to be: ${BOLDNESS_FROM_NOTE}. It is background for you, not something to quote back to her.`,
      ),
    );
  } else if (input.notedPeople && input.notedPeople.length > 0) {
    const people = input.notedPeople.slice(0, NOTED_PEOPLE_MAX).map((person) => {
      const note = person.note.trim();
      const short = note.length > NOTED_NOTE_MAX ? `${note.slice(0, NOTED_NOTE_MAX).trimEnd()}…` : note;
      // A "How they know each other" chosen for this screenshot wins over the remembered one.
      const how = person.context && !input.context ? ` (${CONTEXT_SHORT[person.context]})` : '';
      return `- @${person.username}${how}: ${short}`;
    });
    parts.push(
      section(
        'People he has written notes about',
        `${people.join('\n')}\n\nOnly if the screenshot clearly shows one of these usernames, that note is about her: use it to judge how bold to be (${BOLDNESS_FROM_NOTE}), and take how they know each other from it. If it shows none of them, ignore this list. Never mention these notes, or anyone else on this list, in a line.`,
      ),
    );
  }
  const about = input.profile ? profileText(input.profile) : null;
  if (about) {
    parts.push(section('About the sender', about));
  }
  if (input.memory && input.memory.length > 0) {
    parts.push(section('Earlier with this person (newest first)', memoryText(input.memory)));
  }
  if (input.likedLines && input.likedLines.length > 0 && input.mode !== 'analyse') {
    const liked = input.likedLines.slice(0, 5).map((line) => `- "${line}"`).join('\n');
    parts.push(
      section(
        'Lines he chose before',
        `${liked}\n\nThese show his taste and his voice. Write lines that would sit well among them. Never reuse their words or their hooks.`,
      ),
    );
  }
  if (input.dislikedLines && input.dislikedLines.length > 0 && input.mode !== 'analyse') {
    const disliked = input.dislikedLines
      .slice(0, 3)
      .map((line) => `- "${line.text}" (${FEEDBACK[line.reason]})`)
      .join('\n');
    parts.push(section('Lines he did not like', `${disliked}\n\nAvoid what made these miss.`));
  }
  if (input.mode === 'reply' && input.direction && input.direction !== 'keep_going') {
    const direction = DIRECTION[input.direction];
    parts.push(section(direction.title, direction.body));
  }
  if (input.adjustment && input.mode !== 'analyse') {
    const previous = input.adjustment.previousLines.map((line) => `- "${line}"`).join('\n');
    const fix = input.adjustment.fix;
    const ask = fix
      ? `He marked "${fix.line}" as ${FEEDBACK[fix.reason]}. ${FIX[fix.reason]}`
      : ADJUSTMENT[input.adjustment.kind];
    parts.push(section('Lines just shown', `${previous}\n\n${ask}`));
  }
  const focuses = input.mode === 'analyse' ? [] : cleanFocuses(input.focus);
  if (focuses.length > 0) parts.push(section(`Focus: ${focuses.join(', ')}`, focusText(focuses)));

  if (input.language === 'roman_urdu') {
    parts.push(
      section(
        'Language',
        `Write the lines${input.mode === 'analyse' ? ' (the suggested reply)' : ''} in Roman Urdu: Urdu written in English letters, the way people in Pakistan text each other ("kya scene hai", "acha ji", "itna attitude?"). Mix in English words where people naturally do. Not Urdu script, not Hindi words, not formal Urdu. Keep the same tone, length and rules as in English. Every other field of the answer (what you noticed, hooks, "read") stays in English.`,
      ),
    );
  }

  if (input.mode !== 'analyse') parts.push(section('Check before you answer', finalCheck(input)));

  parts.push('The screenshot is attached.');
  return { system, user: parts.join('\n\n') };
}
