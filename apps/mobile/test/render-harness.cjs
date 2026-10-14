const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const jsx=(type,props,key)=>({type,props,key});
function load(file,modules={},globals={}) {
  const source=fs.readFileSync(path.resolve(__dirname,'..',file),'utf8');
  const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}});
  const exports={};
  vm.runInNewContext(outputText,{exports,Error,process:{env:{EXPO_OS:'web'}},require:name=>{
    if(name==='react/jsx-runtime')return{jsx,jsxs:jsx,Fragment:'fragment'};
    assert.ok(name in modules,'Unexpected module '+name);return modules[name];
  },...globals});
  return exports;
}
function hooks() {
  const slots=[];let cursor=0;const effects=[];
  const react={
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;
      return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
    useRef(initial){const i=cursor++;return slots[i] ??= {current:initial};},
    useMemo(fn,deps){const i=cursor++;const previous=slots[i];if(!previous || deps.some((v,j)=>v!==previous.deps[j]))slots[i]={value:fn(),deps};return slots[i].value;},
    useCallback(fn,deps){return react.useMemo(()=>fn,deps);},
    useEffect(fn,deps){react.useMemo(()=>{effects.push(fn);},deps ?? [Symbol()]);},
    useLayoutEffect(fn,deps){react.useEffect(fn,deps);},
    useImperativeHandle(ref,fn){if(ref)ref.current=fn();},
    useSyncExternalStore(_subscribe,get){return get();},
    createContext:value=>({value}),use:context=>context.value,memo:fn=>fn,
  };
  return{react,render:fn=>{cursor=0;return fn();},flush:()=>effects.splice(0).map(fn=>fn()).filter(fn=>typeof fn==='function')};
}
function nodes(tree) {
  if(!tree || typeof tree!=='object')return[];
  if(Array.isArray(tree))return tree.flatMap(nodes);
  return[tree,...nodes(tree.props?.children)];
}
function label(tree,label){const node=nodes(tree).find(node=>node.props?.accessibilityLabel===label);assert.ok(node,'Missing '+label);return node;}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
module.exports={load,hooks,nodes,label,deferred};
