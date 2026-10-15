const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {load,hooks,nodes}=require('./render-harness.cjs');
const {outbox}=require('./pending-fixture.cjs');
const palette={accent:'blue',muted:'neutral'};
function fixture(){const h=hooks();const component=load('components/outgoing-status.tsx',{
  'react-native':{View:'view',Text:'text'},'lucide-react-native':{Check:'single-tick',CheckCheck:'double-tick'},'../lib/app-state':{useApp:()=>({palette})},'../lib/theme':{fonts:{}}});return{h,component};}
test('only optional receipt evidence draws one neutral, two neutral or two blue ticks, with explicit accessible text',()=>{
  const {component}=fixture();
  for(const [level,icon,color,label] of [['sent','single-tick','neutral','Sent'],['delivered','double-tick','neutral','Delivered'],['read','double-tick','blue','Read']]){
    const tree=component.OutgoingStatus({receipt:{level,observedAt:10,source:'wa_status'}}),tick=nodes(tree).find(node=>node.type===icon);
    assert.ok(tick);assert.equal(tick.props.color,color);assert.equal(tree.props.accessibilityLabel,label);
  }
  for(const simulated of [false,true]){
    const tree=component.OutgoingStatus({simulated});assert.equal(nodes(tree).filter(node=>/tick/.test(node.type)).length,0);
    assert.match(tree.props.accessibilityLabel,/Awaiting WhatsApp acknowledgment/);if(simulated)assert.match(tree.props.accessibilityLabel,/Simulated/);
  }
});
test('mixed components retain their own receipts while unknown/partial action warnings remain visible',()=>{
  const {component}=fixture(),box=outbox('synthetic','partial');
  box.components=[{...box.components[0],id:'a',outgoingReceipt:{level:'read',observedAt:10,source:'wa_status'}},{...box.components[0],id:'b',outgoingReceipt:undefined,state:'accepted'}];
  const tree=component.OutboxStatus({outbox:box}),statuses=nodes(tree).filter(node=>node.type===component.OutgoingStatus);
  assert.equal(statuses.length,2);assert.equal(statuses[0].props.receipt.level,'read');assert.equal(statuses[1].props.receipt,undefined);
  assert.match(nodes(tree).find(node=>node.props?.accessibilityRole==='alert').props.children,/Unresolved send outcome/);
  box.state='unknown';assert.match(nodes(component.OutboxStatus({outbox:box})).find(node=>node.props?.accessibilityRole==='alert').props.children,/Do not resend/);
});
test('outgoing messages use their own optional projection, incoming messages have no ticks, and UI never transmits WhatsApp reads',()=>{
  const root=path.resolve(__dirname,'..');
  const bubble=fs.readFileSync(path.join(root,'components/message-bubble.tsx'),'utf8');assert.match(bubble,/owner && <OutgoingStatus receipt=\{message.outgoingReceipt\}/);
  for(const file of ['components/message-bubble.tsx','components/outgoing-status.tsx','app/conversation/[id].tsx','lib/pending-intents.ts']){
    const source=fs.readFileSync(path.join(root,file),'utf8');assert.doesNotMatch(source,/readMessages\s*\(|sendReadReceipt\s*\(/,file);
  }
});
