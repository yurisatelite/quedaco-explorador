/** QUEDAÇO UI v1. Visual only: no settings, sockets or Document writes. */
export function visible(element){
  return !element.closest('[hidden],details:not([open])>:not(summary)')&&element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden';
}
function control(header,label,text,handler){
  const button=header.ownerDocument.createElement('button');button.type='button';button.className='header-control qd-window-control';button.textContent=text;button.title=label;button.setAttribute('aria-label',label);button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();void handler();});return button;
}
export function enhanceWindow(application,html,{id,roots,primary=[],brand}={}){
  const element=application?.element??html?.[0]??html;
  if(!element?.matches||(!element.matches(roots)&&!element.querySelector(roots)))return false;
  const root=element.closest('.application')??element;
  // Independent modules never take ownership of each other's window.
  if(root.dataset.qdModule&&root.dataset.qdModule!==id)return false;
  root.classList.add('qd-ui','qd-family');root.dataset.qdModule=id;
  const header=root.querySelector(':scope>.window-header');
  if(header){
    for(const [action,symbol,label]of [['close','×','Fechar'],['toggleControls','⋯','Opções da janela']]){
      const button=header.querySelector(`[data-action="${action}"]`);if(!button)continue;
      button.classList.remove('fa-solid','fas','fa-xmark','fa-ellipsis-vertical','icon');button.classList.add('qd-window-control');button.textContent=symbol;button.title=label;button.setAttribute('aria-label',label);
    }
    if(!header.querySelector('[data-qd-window-tools]')&&application?.options?.window?.minimizable!==false&&typeof application?.minimize==='function'){
      const minimize=control(header,'Minimizar / restaurar','−',()=>application.minimized?application.maximize():application.minimize());minimize.dataset.qdWindowTools='';header.insertBefore(minimize,header.querySelector('[data-action="toggleControls"],[data-action="close"]'));
      if(application.options?.window?.resizable&&typeof application.setPosition==='function'){
        let previous=null;
        const expand=control(header,'Ajustar à tela / restaurar','⤢',async()=>{if(application.minimized)await application.maximize();if(previous){application.setPosition(previous);previous=null;}else{previous={...application.position};application.setPosition({left:16,top:16,width:innerWidth-32,height:innerHeight-32});}});header.insertBefore(expand,minimize);
      }
    }
  }
  for(const button of root.querySelectorAll('.window-content button')){
    button.classList.remove('qd-action-primary');
    const operation=button.dataset.action??button.dataset.op??button.dataset.qtAction??'';
    button.classList.toggle('qd-action-danger',/^(delete|purge|remove-|archive|reset)/.test(operation));
  }
  const candidates=primary.flatMap(selector=>Array.from(root.querySelectorAll(selector)));
  const selected=candidates.find(button=>!button.disabled&&visible(button))??candidates.find(visible);
  selected?.classList.add('qd-action-primary');
  for(const wallet of root.querySelectorAll('.sy-stats,.sy-wallet,.qt-wallet,.qnv-wallet,[data-qd-currency]')){
    const children=Array.from(wallet.children);
    if(children.length===3&&['K$','P$','T$'].every(currency=>children.some(child=>child.textContent.includes(currency))))wallet.classList.add('qd-equal-cards');
  }
  if(brand)for(const lockup of root.querySelectorAll('.sy-brand-lockup')){
    const logo=lockup.querySelector('img');
    if(!logo?.getAttribute('src')?.includes(`/modules/${id}/`)&&!logo?.getAttribute('src')?.startsWith(`modules/${id}/`))continue;
    lockup.replaceChildren();lockup.classList.add('qd-brand');
    const mark=lockup.ownerDocument.createElement('span');mark.className='qd-brand-mark';mark.textContent='Q';mark.setAttribute('aria-hidden','true');
    const name=lockup.ownerDocument.createElement('span'),title=lockup.ownerDocument.createElement('strong'),subtitle=lockup.ownerDocument.createElement('small');title.textContent='QUEDAÇO';subtitle.textContent=brand;name.append(title,subtitle);lockup.append(mark,name);
  }
  if(!root.dataset.qdClamped&&typeof application?.setPosition==='function'&&!application.minimized){
    root.dataset.qdClamped='true';const rect=root.getBoundingClientRect();
    if(rect.width>innerWidth-32||rect.height>innerHeight-32)application.setPosition({width:Math.min(rect.width,innerWidth-32),height:Math.min(rect.height,innerHeight-32),left:Math.max(16,Math.min(rect.left,innerWidth-Math.min(rect.width,innerWidth-32)-16)),top:Math.max(16,Math.min(rect.top,innerHeight-Math.min(rect.height,innerHeight-32)-16))});
  }
  return true;
}

export function registerVisualIdentity(config){globalThis.Hooks?.on('renderApplicationV2',(app,html)=>enhanceWindow(app,html,config));}

export const VISUAL_CONFIG={
  "id": "quedaco-explorador",
  "roots": ".qe-app",
  "primary": [
    "button[data-action=\"save-hex\"]",
    "button[type=\"submit\"]",
    ".qe-primary",
    ".form-footer button:not([data-action=\"cancel\"],[data-action=\"close\"])"
  ]
};
registerVisualIdentity(VISUAL_CONFIG);

