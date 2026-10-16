const test=require('node:test');
const assert=require('node:assert/strict');
const {load,deferred}=require('./render-harness.cjs');
const {lifecycleHooks}=require('./lifecycle-harness.cjs');
const {core,apiFixture}=require('./profile-fixture.cjs');

test('ui57 Latest survives a same-height page replacement before its animation frame, without premature viewed IDs',()=>{
  const h=lifecycleHooks(),frames=new Map(),moves=[];let serial=0,page={messages:[]};
  const history={get:()=>page};
  const module=load('lib/conversation-scroll.ts',{react:h.react,'react-native':{}},{
    requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id),setTimeout,clearTimeout,
  });
  const render=()=>h.commit(()=>module.useConversationScroll(history,'chat',true,()=>{},page));
  const frame=()=>{const next=[...frames.values()];frames.clear();next.forEach(fn=>fn());};
  render().scroll.current={scrollTo:({y})=>moves.push(y)};
  render().onLayout({nativeEvent:{layout:{width:320,height:400}}});render().onContentSizeChange(320,1000);frame();
  render().onScroll({nativeEvent:{contentOffset:{y:600},layoutMeasurement:{width:320,height:400},contentSize:{height:1000}}});
  render().onScrollBeginDrag();render().onScroll({nativeEvent:{contentOffset:{y:100},layoutMeasurement:{width:320,height:400},contentSize:{height:1000}}});render().onScrollEndDrag();
  const before=moves.length;render().latest();page={messages:[]};render();frame();
  assert.equal(moves.length,before+1);assert.equal(moves.at(-1),600);
  assert.equal(render().settled,false);assert.deepEqual([...render().visibleIds],[]);assert.equal(render().isVisibilityCurrent(),false);
  h.unmount();assert.equal(frames.size,0);
});
test('ui57 a late cold/older read cannot replace a newer Latest; each request stays at 50 rows',async()=>{
  const api=apiFixture(()=>assert.fail('No external requests')),{HistoryCache}=load('lib/history-cache.ts',{'./api':api,'@replybot/core/api':core});
  const cold=deferred(),around=deferred(),calls=[];let first=true;
  const page=id=>({conversationId:'chat',messages:[{id,accountId:'a',conversationId:'chat',transportId:'wa-'+id,direction:'inbound',authorship:'contact_written',text:id,occurredAt:1,source:'live',quotedMessageId:null,statusReply:false,statusContext:null,media:null,reaction:null}],unavailableSourceIds:[],sourceEpoch:1,revision:1,beforeCursor:null,afterCursor:null,hasOlder:false,hasNewer:false,latestMessageId:id});
  const cache=new HistoryCache({assertActive(){},request:async(path,schema)=>{calls.push(path);if(path.includes('around='))return schema.parse(await around.promise);if(first){first=false;return schema.parse(await cold.promise);}return schema.parse(page('latest'));}});cache.configure(true);
  const initial=cache.load('chat'),older=cache.around('chat','old');cache.cancelPageReads('chat');await cache.latest('chat');
  cold.resolve(page('cold'));around.resolve(page('old'));await Promise.all([initial,older]);
  assert.equal(cache.get('chat').messages[0].id,'latest');assert.equal(cache.anchor('chat'),undefined);
  assert.equal(calls.length,3);assert.ok(calls.every(path=>path.includes('limit=50')));
});
