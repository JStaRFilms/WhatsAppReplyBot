const test=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./render-harness.cjs');
const {lifecycleHooks}=require('./lifecycle-harness.cjs');

function fixture(hasNewer=true){
  const h=lifecycleHooks(),frames=new Map(),timers=new Map(),moves=[];
  let serial=0,offset=0,contentHeight=5180,page={hasNewer},anchor;
  const rows=new Map([['source046',{y:4494,height:89}],['source049',{y:4800,height:380}]]);
  const history={get:()=>page,pin:(_id,value)=>{anchor=value;},anchor:()=>anchor};
  const module=load('lib/conversation-scroll.ts',{react:h.react,'react-native':{}},{
    requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:key=>frames.delete(key),
    setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:key=>timers.delete(key),
  });
  const node=rect=>({measureInWindow:callback=>callback(...rect())});
  const viewport=node(()=>[0,134,390,630]),content=node(()=>[0,134-offset,390,contentHeight]);
  const scroll={getNativeScrollRef:()=>viewport,scrollTo:({y})=>{moves.push(y);offset=y;}};
  const render=()=>h.commit(()=>module.useConversationScroll(history,'chat',true,()=>{},page));
  render().scroll.current=scroll;render().content.current=content;
  const frame=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
  const complete=()=>{for(let n=0;n<12 && frames.size;n++){frame();render();}assert.equal(frames.size,0);};
  const scrolled=(y=offset)=>{offset=y;render().onScroll({nativeEvent:{contentOffset:{y},layoutMeasurement:{width:390,height:630},contentSize:{height:contentHeight}}});};
  const retain=()=>render().retainRows([...rows.keys()]);
  for(const [id,row] of rows){const refs=render().rowRefs(id),n=node(()=>[0,134+row.y-offset,390,row.height]);refs.turn(n);refs.source(n);}
  render().onLayout({nativeEvent:{layout:{width:390,height:630}}});render().onContentSizeChange(390,contentHeight);retain();complete();scrolled();complete();
  render().locate(215);complete();scrolled();complete();
  const append=(height=10034)=>{contentHeight=height;page={...page};render();retain();render().onContentSizeChange(390,height);complete();};
  const close=()=>{h.unmount();assert.equal(frames.size+timers.size,0);};
  return {render,scrolled,complete,frame,moves,rows,append,close,physical:y=>{offset=y;},offset:()=>offset,
    sourceOffset:()=>rows.get('source046').y-offset,tail:()=>{page.hasNewer=false;}};
}

for(const hasNewer of [true,false])for(const order of ['before-restore','after-restore'])test(`ui65 trailing scroll ${order}, hasNewer=${hasNewer}, retains the measured source through append`,()=>{
  const f=fixture(hasNewer);try{
    f.scrolled(4550);f.complete();assert.equal(f.sourceOffset(),-56);
    f.render().preserve();
    if(order==='before-restore'){f.scrolled();f.complete();}
    f.render().restore();f.complete();assert.equal(f.render().position.target,null);
    if(order==='after-restore'){f.scrolled();f.complete();}
    f.append();f.scrolled();f.complete();
    assert.ok(Math.abs(f.sourceOffset()+56)<=3,`physical source offset ${f.sourceOffset()}`);
    assert.equal(f.render().position.following,false);assert.equal(f.render().position.target,null);
    assert.deepEqual([...f.render().visibleIds],['source046','source049']);
  }finally{f.close();}
});

test('ui65 old loaded-window bottom is not actual-tail following, including drag end and editor close',()=>{
  const f=fixture();try{
    f.scrolled(4550);f.complete();assert.equal(f.render().atBottom,true);assert.equal(f.render().position.following,false);
    f.render().onScrollBeginDrag();f.scrolled(4540);f.render().onScrollEndDrag();f.complete();assert.equal(f.render().position.following,false);
    f.render().editorFocus(42);f.render().editorBlur(42);f.render().editorFocus(null,42);assert.equal(f.render().position.following,false);
  }finally{f.close();}
});

test('ui65 measurement before a genuine event does not swallow renewed actual-tail following',()=>{
  const f=fixture(false);try{
    f.scrolled(4400);f.complete();f.render().preserve();f.render().restore();f.complete();
    f.physical(4550);f.render().refreshRows(false);f.complete();assert.equal(f.render().position.offset,4550);
    assert.equal(f.render().position.following,false);
    f.scrolled(4550);f.complete();assert.equal(f.render().position.following,true);
    f.append(6000);f.scrolled();f.complete();assert.equal(f.offset(),5370);
  }finally{f.close();}
});

test('ui65 genuine navigation supersedes a queued preserve restoration rather than snapping back',()=>{
  const f=fixture(false);try{
    f.scrolled(4550);f.complete();f.render().preserve();f.render().restore();
    f.scrolled(4000);f.complete();assert.equal(f.offset(),4000);assert.equal(f.render().position.following,false);
    f.append();f.scrolled();f.complete();assert.equal(f.offset(),4000);
  }finally{f.close();}
});

test('ui65 a restoration measured before its native event cannot masquerade as new following intent',()=>{
  const f=fixture(false);try{
    f.scrolled(4550);f.complete();f.render().preserve();
    for(const row of f.rows.values())row.y+=100;
    f.append(5280);f.render().refreshRows();f.complete();assert.equal(f.render().position.target,null);
    assert.equal(f.offset(),4650);f.scrolled();f.complete();
    assert.equal(f.render().position.following,false);assert.equal(f.sourceOffset(),-56);
    f.append(10034);f.scrolled();f.complete();assert.equal(f.sourceOffset(),-56);
  }finally{f.close();}
});

test('ui65 explicit Latest still overrides preservation and follows the known or fetched tail',()=>{
  const f=fixture();try{
    f.scrolled(4550);f.complete();f.render().preserve();f.render().latest();f.complete();
    assert.equal(f.render().position.following,true);f.tail();f.append();f.scrolled();f.complete();
    assert.equal(f.offset(),9404);assert.equal(f.render().position.following,true);
  }finally{f.close();}
});
