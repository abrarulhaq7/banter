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
        `${aboutHer}\n\nUse this to judge how bold to be: bolder when it says she flirts back or they are close, lighter when it says she keeps things friendly. It is background for you, not something to quote back to her.`,
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

  parts.push('The screenshot is attached.');
  return { system, user: parts.join('\n\n') };
}
