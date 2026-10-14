import { useApp } from '../lib/app-state';
export function DateTimeField({value,onChange}:{value:Date;onChange:(value:Date)=>void}) {
  const {palette,dark}=useApp();
  const local=(date:Date)=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
  return <input aria-label="Automation end date and time" type="datetime-local" value={local(value)} min={local(new Date())}
    onChange={event=>{const date=new Date(event.target.value);if(Number.isFinite(date.getTime()))onChange(date);}}
    style={{background:palette.surface,color:palette.text,border:'1px solid '+palette.border,borderRadius:10,padding:12,font:'inherit',colorScheme:dark ? 'dark' : 'light'}}/>;
}
