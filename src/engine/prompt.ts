import type { Adjustment, BuiltPrompt, ContextId, MemoryItem, PromptInput, SenderProfile } from './types';

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
    parts.push(section(`Tone: ${input.tone.label}`, input.tone.definition));
  }
  if (input.context) {
    parts.push(section('How they know each other', CONTEXT[input.context]));
  }
  const about = input.profile ? profileText(input.profile) : null;
  if (about) {
    parts.push(section('About the sender', about));
  }
  if (input.memory && input.memory.length > 0) {
    parts.push(section('Earlier with this person (newest first)', memoryText(input.memory)));
  }
  if (input.adjustment && input.mode !== 'analyse') {
    const previous = input.adjustment.previousLines.map((line) => `- "${line}"`).join('\n');
    parts.push(section('Lines just shown', `${previous}\n\n${ADJUSTMENT[input.adjustment.kind]}`));
  }

  parts.push('The screenshot is attached.');
  return { system, user: parts.join('\n\n') };
}
