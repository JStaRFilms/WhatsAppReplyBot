import type { Message, ReactionObservation } from '@replybot/core/contracts';

export function groupMessageReactions(message:Message):{emoji:string;actors:string[]}[] {
  if(message.observedReactions===undefined)return message.reaction ? [{emoji:message.reaction,actors:['You']}] : [];
  const slots=new Map<string,ReactionObservation>();
  for(const observation of message.observedReactions){
    // AI and native owner echoes use the same WhatsApp account reaction slot.
    const slot=observation.actor==='owner' || observation.actor==='assistant' ? 'account:'+message.accountId : 'actor:'+observation.actorId;
    const previous=slots.get(slot);
    if(!previous || observation.occurredAt>=previous.occurredAt)slots.set(slot,observation);
  }
  const groups=new Map<string,string[]>();
  for(const observation of slots.values()){
    if(!observation.emoji)continue;
    const actors=groups.get(observation.emoji) ?? [];
    actors.push(observation.actor==='owner' || observation.actor==='assistant' ? 'You' : observation.actor==='contact' ? 'Contact' : 'Unknown sender');
    groups.set(observation.emoji,actors);
  }
  return [...groups].map(([emoji,actors])=>({emoji,actors}));
}
