import { SqliteStore, Conversation, Message, Draft, Outbox } from '@replybot/core';
export const accountId = 'whatsapp-owner';
export const now = 2000000;
export const phone = (i: number) => (15550000000+i)+'@s.whatsapp.net';
export function fixture(dense = false) {
  const store = new SqliteStore(); const db = store['db'];
  const conversations = dense ? 100 : 3437;
  db.exec('BEGIN');
  const insert = db.prepare('INSERT INTO conversations VALUES(?,?,?)');
  for(let i=0;i<conversations;i++) {
    const c = Conversation.parse({id:phone(i),accountId,contactId:phone(i),name:'Invented '+i,kind:'direct',mode:null,excluded:false,control:'assistant_allowed',workflowVersion:1,policyVersion:1,lastHumanActivityAt:i,hours:null});
    insert.run(c.id,accountId,JSON.stringify(c));
  }
  const alias = db.prepare('INSERT INTO wa_aliases VALUES(?,?,?)');
  if(!dense) for(let i=0;i<3115;i++) alias.run(accountId,(900000+i)+'@lid',phone(i));
  const message = db.prepare('INSERT INTO messages VALUES(?,?,?,?)');
  const total = dense ? 200000 : 1657;
  for(let i=0;i<total;i++) {
    const chat = dense ? i%100 : i<275 ? 0 : 1+(i-275)%344;
    const m = Message.parse({id:'synthetic-'+i,accountId,conversationId:phone(chat),transportId:'transport-'+i,direction:'inbound',authorship:'contact_written',text:'Invented message '+i,occurredAt:i,source:'live',quotedMessageId:null,statusReply:false,statusContext:null,media:null,reaction:null});
    message.run(m.id,accountId,m.conversationId,JSON.stringify(m));
  }
  db.prepare('INSERT INTO account_settings(account_id,release_context_version,history_projection_version) VALUES(?,1,1)').run(accountId);
  if(!dense) {
    const draft=db.prepare('INSERT INTO drafts VALUES(?,?,?,?)'),outbox=db.prepare('INSERT INTO outbox VALUES(?,?,?,?)');
    for(let i=0;i<166;i++) {
      const d=Draft.parse({id:'draft-'+i,accountId,conversationId:phone(i),triggerMessageId:'synthetic-'+i,workflowVersion:1,policyVersion:1,revision:1,action:{kind:'text',text:'Invented draft',reason:'Fixture'},state:'pending',createdAt:i,edited:false});
      draft.run(d.id,accountId,d.conversationId,JSON.stringify(d));
    }
    for(let i=0;i<135;i++) {
      const o=Outbox.parse({id:'outbox-'+i,accountId,conversationId:phone(i),requestId:'request-'+i,workflowVersion:1,policyVersion:1,action:{kind:'text',text:'Invented sent text',reason:'Fixture'},origin:'owner_manual',state:'accepted',components:[{id:'part-'+i,kind:'text',text:'Invented sent text',reaction:null,state:'accepted',transportId:'sent-'+i}],quotedMessageId:null,grantId:null,units:1,transportId:'sent-'+i,authoredAs:'owner_written',createdAt:i});
      outbox.run(o.id,accountId,o.conversationId,JSON.stringify(o));
    }
  }
  db.exec('COMMIT'); return store;
}
