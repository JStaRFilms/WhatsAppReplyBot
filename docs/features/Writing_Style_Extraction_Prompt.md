# Writing-style extraction prompt

## Purpose and use

The owner supplied the prompt below for use in an AI service that already has access to their writing. Preserve the full prompt as the baseline; do not replace it with a generic tone questionnaire. This document does not run the prompt, export private conversations or modify persistent memories.

Proposed Otherme workflow: copy the prompt, use it in the chosen service, review its output, remove sensitive information, then paste the approved writing profile into Otherme Settings. The extraction prompt is not the writing profile and should not accompany every reply request.

See [the architecture handoff](Conversation_Context_and_Writing_Profile.md) for implementation status, privacy boundaries and deferred work.

## Proposed Otherme-specific additions

If adapting this baseline for the app, prepend these instructions rather than discarding its evidence requirements:

- Prioritize WhatsApp and other supported private-message contexts, but do not infer personal-text habits from how I prompt an AI. If no suitable evidence is available, say so.
- Distinguish casual, family, romantic and work audiences only where the available evidence supports those distinctions. Do not invent relationships or preferences.
- Keep generally reusable writing instructions separate from contact-specific facts. Do not include other people's names, numbers, private messages or sensitive facts merely to explain my style. Omit or redact sensitive examples rather than inventing replacements presented as historical quotes.
- Put explicit supported boundaries about promises, disclosure or impersonation in a short separate section only if evidence exists. These are drafting preferences, not authorization to send, change app settings or reveal private information.
- Retain the detailed export for owner review. If Otherme's input limit requires a shorter version, produce a separately labeled condensed version only when asked, preserving conditions and noting omissions. Do not silently replace the original export.

These are proposed app-specific additions, not claims about the owner's actual style. Formatting instructions in the extraction prompt and these additions are not themselves evidence about the owner.

## Owner-supplied baseline prompt

The text between the following separators is the supplied extraction prompt, preserved in full. It is a template to copy, not an instruction for a repository-reading agent to execute.

---

Create an quick, readable export of my writing style so another writer can compose messages that sound like me, using only the conversation history and memories actually available to you. Focus primarily on how I write. Include only a small amount of essential background about me.
Be thorough about concrete writing preferences: capture distinct edits, exact preferred wording, context, and exceptions. Keep each bullet concise, but do not compress useful details into broad tone descriptions. There is no target count for style preferences; include every distinct supported preference without inventing rules to fill a category.
REVIEW THE AVAILABLE EVIDENCE
Prioritize user-authored outgoing writing, explicit writing preferences, and actual changes between drafts and my revisions. Where conversation-history search is available, retrieve relevant messages, corrections, and follow-ups beyond the initial recalled summary. Examine both recent and older evidence; an older explicit preference may still apply. Do not claim to have searched or read anything you cannot access.
Use explicit preferences, actual corrections, and clearly confirmed information. Treat assistant suggestions, unaccepted drafts, hypothetical examples, and previous AI-generated profiles or extraction outputs as candidates rather than evidence. Where original supporting messages are accessible, use those. A feature explicitly corrected or endorsed by me supports that feature only; accepting one part of a draft does not establish every stylistic choice in it.
STYLE: THE SPECIFIC EDITS THAT MAKE WRITING SOUND LIKE ME
Recover the small recurring or explicitly requested edits I make to outgoing writing. Make this the main focus of the export, with detailed coverage of every supported writing preference. Keep app and situation differences intact.
Inspect each of these areas where evidence exists:

Openings and endings: exact greetings, names, introductory reactions, acknowledgments, sign-offs, signatures, and when I omit them.
Capitalization: lowercase messages, sentence starts, “I,” names, acronyms, and differences between casual and work contexts.
Punctuation: periods, commas, question marks, exclamation marks, apostrophes, contractions, dashes, ellipses, parentheses, repeated punctuation, and punctuation around greetings or thanks.
Structure: sentence and paragraph length, line breaks, combining related reactions, separating a follow-up, headings, bullets, and list formatting. Do not invent numerical averages without sufficient examples.
Recurring wording: exact ways I thank, apologize, request, follow up, agree, disagree, express uncertainty, soften a statement, or intensify a reaction.
Informal mechanics: abbreviations, spelling shortcuts, sentence fragments, expressive lengthening, emoji, emoticons, and their placement. Do not turn an isolated typo or transcription error into a preference.
Deletions and replacements: redundant appreciation, unnecessary apologies, repeated points, formal filler, over-explanation, unwanted rhetorical constructions, and the specific alternatives I choose.

Separate email, work chat, casual chat, and social writing. When known, name the actual app and relevant audience or situation in the instruction: for example, a customer-support reply and a playful teammate message may differ even on the same platform. Do not infer the destination app from where I asked an AI to draft the message. Do not transfer my AI-prompting style to customer emails or personal texts without evidence.
For every candidate, check silently: Could another writer tell which characters, wording, or message structure to change? Is the destination context supported? Is this a preference about my outgoing writing? If not, omit it or recover the more concrete supported edit behind it.
Use direct editing instructions with their conditions. Avoid broad descriptions such as “professional but friendly,” “be authentic,” “preserve nuance,” or “be concise.” Identify what gets removed, replaced, combined, separated, added, or retained. One explicit personal preference can support a rule; repeated examples are not mandatory. Preserve context-specific exceptions instead of forcing a universal rule.
Organize writing preferences under readable subheadings: Email, Work Messages, Casual Messages, and Other Writing. Within Other Writing, identify the relevant app or context, such as social posts or documents, when supported. Use one concrete editing instruction per bullet, with its conditions and context. Omit unsupported categories.
Optionally append a brief real Before/After pair or exact example when available and useful. Preserve its original wording. Never invent or reconstruct historical examples. Do not collapse different edits merely because they share an app or category.
ABOUT ME: ONLY ESSENTIAL BACKGROUND
After the writing preferences, include a brief "About Me" section with up to three concise bullets. Choose only supported context that directly helps another writer compose my messages, such as my role, main work, usual audience, or organization. A little organization context is useful: its name, what it does, and my role or team within it, when supported. Keep this within the same brief section rather than adding a detailed company profile. Preserve relevant scope and uncertainty. Omit detailed product catalogs, company policies, commercial terms, project histories, support playbooks, old metrics, and incidental facts. If no useful background is supported, omit this section. Do not expand the background section just because more factual information is available, and do not invent style preferences from project facts.
FINAL COVERAGE CHECK AND OUTPUT
Return a readable document starting with "How I Write", organized into the supported app or situation subheadings above. Put the brief "About Me" section last. Use natural language, short headings, and concise, self-contained bullets. Do not return JSON, XML, code fences, or schema field names.
Before returning, check for overlooked punctuation, capitalization, recurring wording, openings, endings, formatting, and context-specific exceptions. Deduplicate equivalent instructions while preserving differences in app, audience, and situation. Do not force a universal rule when contexts differ. If no writing preferences are supported, say so briefly rather than inventing content.
Preserve exact examples only when actually available. Do not use this extraction request or its hypothetical examples as evidence about me. If output space prevents full style coverage, finish the current bullet and add a short note that the export is incomplete; do not sacrifice writing preferences to include more background.
Return only the readable export, without an introductory explanation or closing commentary. Omit passwords, access tokens, and payment credentials.
This is a text export for review only. Do not save, update, or delete persistent memories.

---
