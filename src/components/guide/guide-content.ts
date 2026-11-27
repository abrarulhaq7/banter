import type { IconName } from '@/components/ui';

/**
 * The Guide's words, in one place. Option names are written as they read on Generate, so
 * a reader can find them. Example lines are made up (never from anyone's screenshots), and
 * follow the core rules: wit with a stranger, looks and heat only when they know each other.
 */

/** One situation, with the options that suit it best. */
export type GuideSetup = {
  id: string;
  icon: IconName;
  title: string;
  /** The options to pick on Generate, in the order they appear there. */
  choose: string[];
  /** Other tones that also suit it. */
  alsoTry?: string;
  why: string;
  example: { label: string; scene: string; line: string };
};

/** One kind of option, with what each choice does. */
export type GuideTopic = {
  id: string;
  icon: IconName;
  title: string;
  subtitle: string;
  items: { name: string; text: string }[];
  note?: string;
};

export const GUIDE_SETUPS: GuideSetup[] = [
  {
    id: 'story-stranger',
    icon: 'screenshot',
    title: "Her story, you're strangers",
    choose: ['Story reply', 'Flirty', 'Stranger'],
    alsoTry: 'Funny or Teasing',
    why: "With someone who doesn't know you, wit and curiosity win, never her looks. Flirty shows a little interest; Funny and Teasing get a laugh first.",
    example: {
      label: 'Example',
      scene: 'Latte art on a café table',
      line: 'you rate every café out of ten and keep the scores to yourself',
    },
  },
  {
    id: 'story-close',
    icon: 'interests',
    title: 'Her story, you two are close',
    choose: ['Story reply', 'Spicy', 'Know her'],
    alsoTry: 'Flirty',
    why: 'When you know each other, a confident compliment on how she looks is fine, and Spicy makes your interest plain. Never crude.',
    example: {
      label: 'Example',
      scene: 'Her mirror selfie before a night out',
      line: 'going out looking like that and you expect me to stay in?',
    },
  },
  {
    id: 'first-message',
    icon: 'sent',
    title: 'First message to her',
    choose: ['Opener', 'Mysterious', 'Stranger'],
    alsoTry: 'Funny or Confident',
    why: 'A first message should make her curious, not list compliments. Mysterious says a little less, so she wants to answer.',
    example: {
      label: 'Example',
      scene: 'Her bio says "professional overthinker"',
      line: 'a professional overthinker has drafted three replies to this already',
    },
  },
  {
    id: 'chat-flowing',
    icon: 'replied',
    title: "A chat that's going well",
    choose: ['Reply', 'Flirty', 'Already talking', 'Keep it going'],
    alsoTry: 'Teasing',
    why: 'Banter texts the way she texts, just as short and casual, and builds on what she just said, so the chat keeps flowing.',
    example: {
      label: 'Example',
      scene: 'She wrote "ugh so bored at work"',
      line: "i'm signing your early leave, tell them it's medical",
    },
  },
  {
    id: 'heat',
    icon: 'bolder',
    title: 'You want it hotter',
    choose: ['Reply', 'Spicy', 'Already talking', 'Turn up the heat'],
    why: "It reads her mood first, then goes one step hotter: suggestive, not explicit. If she's cold, it says so and keeps it light.",
    example: {
      label: 'Example',
      scene: 'She asked "what are you up to tonight?"',
      line: 'was keeping it open for the right offer',
    },
  },
  {
    id: 'ask-out',
    icon: 'date',
    title: 'You want to meet her',
    choose: ['Reply', 'Confident', 'Already talking', 'Ask her out'],
    why: 'A specific plan she can easily say yes to beats "we should hang out sometime". It checks first that the chat is warm enough.',
    example: {
      label: 'Example',
      scene: "You've been joking about coffee",
      line: 'coffee this week, you pick the place',
    },
  },
  {
    id: 'not-sure',
    icon: 'search',
    title: "Not sure she's into you",
    choose: ['Analyse'],
    why: 'It reads her replies (how long they are, whether she asks back, who starts) and tells you honestly. If the signs are cold, it says to leave it.',
    example: {
      label: 'What it tells you',
      scene: 'She keeps replying "maybe" and "busy"',
      line: "She's pulling back. Leave it for now.",
    },
  },
  {
    id: 'roman-urdu',
    icon: 'language',
    title: 'She texts in Roman Urdu',
    choose: ['Reply', 'Casual', 'Roman Urdu'],
    alsoTry: 'any tone',
    why: 'Tap English on Generate to switch. The lines come in Urdu written in English letters, the way people text, with English words where they fit.',
    example: {
      label: 'Example',
      scene: 'She posted chai at 2 am',
      line: 'itni raat ko chai? neend se dushmani hai kya',
    },
  },
];

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: 'modes',
    icon: 'screenshot',
    title: 'What you screenshot',
    subtitle: 'Story reply, Opener, Reply, Analyse',
    items: [
      { name: 'Story reply', text: 'Her story. You get 3 replies to it.' },
      { name: 'Opener', text: 'Her profile. You get 3 first messages.' },
      { name: 'Reply', text: 'Your chat with her. You get 3 next messages, written the way she texts.' },
      { name: 'Analyse', text: 'Your chat. How interested she seems, and one reply, or "leave it".' },
    ],
  },
  {
    id: 'tones',
    icon: 'tone',
    title: 'Tones',
    subtitle: 'How the lines sound',
    items: [
      { name: 'Casual', text: 'Relaxed and low effort, like texting a friend.' },
      { name: 'Funny', text: 'Makes her laugh with something in the screenshot.' },
      { name: 'Flirty', text: 'Shows interest: warm, with a little tension.' },
      { name: 'Spicy', text: 'Real heat. Bold only when you know her.' },
      { name: 'Confident', text: 'Direct. Says what he wants.' },
      { name: 'Safe', text: 'Polite, with zero risk.' },
      { name: 'Teasing', text: 'Playful banter that pokes fun at something small.' },
      { name: 'Mysterious', text: 'Says less and leaves her curious.' },
      { name: 'Sincere', text: 'Warm and genuine.' },
    ],
    note: "Tap the Tones icon on Generate to see them all: the arrows put your favourites first, the eye hides the ones you don't use, and you can pick a hidden one. Make your own in My tones.",
  },
  {
    id: 'how-you-know-her',
    icon: 'person',
    title: 'How you know her',
    subtitle: 'How bold the lines may get',
    items: [
      { name: 'Stranger', text: "She doesn't know you. Nothing about her looks, no innuendo: wit and curiosity only." },
      { name: 'Mutual follow', text: "You follow each other but haven't really talked. The same as a stranger." },
      {
        name: 'Know her',
        text: 'You know each other in real life. Compliments on her looks are fine, and Spicy can bring heat.',
      },
      { name: 'Already talking', text: "You're in a conversation. The same freedom as Know her." },
    ],
    note: 'Not set counts as a stranger. Banter remembers your choice for each person.',
  },
  {
    id: 'where-to-take-it',
    icon: 'forward',
    title: 'Where to take it',
    subtitle: 'Reply only',
    items: [
      { name: 'Keep it going', text: 'The usual next message.' },
      { name: 'Turn up the heat', text: "Reads her mood, then one step hotter. Backs off if she's cold." },
      { name: 'Ask her out', text: 'A specific, low-pressure plan, when the chat is warm enough.' },
    ],
    note: 'It goes back to Keep it going for each new screenshot.',
  },
  {
    id: 'more',
    icon: 'info',
    title: 'More options',
    subtitle: 'Help me pick, Focus on, language, Who is she, and the lines',
    items: [
      {
        name: 'Help me pick',
        text: 'Three quick questions (what it is, how you know her, what you want) set Generate up the way these setups do. They open when you choose a screenshot; you can turn that off in them.',
      },
      {
        name: 'Focus on',
        text: "Pick up to 3 things in the screenshot (her nails, her dress, the café) and you get 5 lines: 3 about them and 2 of Banter's own picks. Add your own pills; hold one to remove it. With a stranger the lines still stay off her looks.",
      },
      { name: 'English / Roman Urdu', text: 'One tap on Generate switches the language of the lines.' },
      {
        name: 'Who is she',
        text: 'After you pick a screenshot, choose her from your people, so her note and what you sent before count from the first set.',
      },
      { name: 'Like', text: 'The thumbs up: more like this. Liked lines teach Banter your taste.' },
      { name: 'Not for me', text: 'The thumbs down: say why (too much, cringe…) and get a fixed set in one tap.' },
      { name: 'Save', text: 'The bookmark keeps a line in People, under Saved.' },
      { name: 'New lines, Shorter, Bolder, Tone', text: 'Another set for the same screenshot.' },
    ],
  },
];

/** A setup or a topic by its id. */
export function guideEntry(
  id: string,
): { kind: 'setup'; setup: GuideSetup } | { kind: 'topic'; topic: GuideTopic } | null {
  const setup = GUIDE_SETUPS.find((item) => item.id === id);
  if (setup) return { kind: 'setup', setup };
  const topic = GUIDE_TOPICS.find((item) => item.id === id);
  return topic ? { kind: 'topic', topic } : null;
}
