// Script à coller sur le site du club :
// <script src="https://VOTRE-DOMAINE/embed.js" data-venue="slug-du-club" async></script>
// Il ajoute un bouton flottant qui ouvre le widget dans un panneau sur le côté droit (comme Zenchef).
// Options : data-mode="modal" (fenêtre centrée au lieu du panneau), data-manager="CODE" (lien d'un manager),
// data-button="none" (pas de bouton flottant), data-page="billets" (ouvre la billetterie par défaut).
// Tout élément du site portant data-tablo-open ouvre le panneau ; data-tablo-open="billets" ouvre directement les entrées.

export async function GET(req: Request) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const js = `(function(){
  var s=document.currentScript||document.querySelector('script[data-venue]');
  if(!s||window.Tablo)return;
  var slug=s.getAttribute('data-venue'),m=s.getAttribute('data-manager'),modal=s.getAttribute('data-mode')==='modal',noBtn=s.getAttribute('data-button')==='none';
  var page0=s.getAttribute('data-page')==='billets'?'billets':'';
  var url=function(p){return '${origin}/w/'+encodeURIComponent(slug)+(p==='billets'?'/billets':'')+(m?'?m='+encodeURIComponent(m):'')};
  var o,f,b,isOpen=false,mobile=function(){return window.innerWidth<700};
  function build(t){
    b=document.createElement('button');b.type='button';b.textContent=page0?'Prendre mon entrée':(t.fab||'Réserver un carré');
    b.style.cssText='position:fixed;right:20px;bottom:20px;z-index:2147483000;border:0;cursor:pointer;padding:15px 22px;font:800 15px system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.35);background:'+(t.btn||'#fff')+';color:'+(t.on||'#111')+';border-radius:'+(t.radius||'999px');
    if(noBtn)b.style.display='none';
    o=document.createElement('div');
    o.style.cssText='position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.55);opacity:0;pointer-events:none;transition:opacity .25s';
    f=document.createElement('iframe');f.title='Réservation';f.setAttribute('allow','payment');
    if(modal&&!mobile())f.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(1180px,96vw);height:min(860px,94vh);border:0;border-radius:20px;background:#000';
    else f.style.cssText='position:absolute;top:0;right:0;height:100%;width:'+(mobile()?'100%':'min(560px,100%)')+';border:0;background:#000;box-shadow:-20px 0 60px rgba(0,0,0,.45);transform:translateX(100%);transition:transform .35s cubic-bezier(.2,.8,.2,1)';
    var x=document.createElement('button');x.type='button';x.setAttribute('aria-label','Fermer');x.textContent='✕';
    x.style.cssText='position:absolute;top:14px;z-index:2;width:40px;height:40px;border-radius:50%;border:0;background:#fff;color:#111;font-size:16px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.3);'+(modal||mobile()?'right:14px':'right:min(574px,calc(100% - 54px))');
    o.appendChild(f);o.appendChild(x);document.body.appendChild(o);document.body.appendChild(b);
    b.onclick=function(){open()};x.onclick=close;o.onclick=function(e){if(e.target===o)close()};
    document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
    document.addEventListener('click',function(e){var el=e.target.closest&&e.target.closest('[data-tablo-open]');if(el){e.preventDefault();open(el.getAttribute('data-tablo-open'))}});
  }
  function open(p){if(!o)return;var want=url(p==='billets'?'billets':p===undefined||p===null||p===''?page0:'');if(f.getAttribute('src')!==want)f.setAttribute('src',want);isOpen=true;o.style.opacity='1';o.style.pointerEvents='auto';f.style.transform=modal&&!mobile()?'translate(-50%,-50%)':'translateX(0)';b.style.visibility='hidden';document.documentElement.style.overflow='hidden'}
  function close(){if(!o)return;isOpen=false;o.style.opacity='0';o.style.pointerEvents='none';if(!(modal&&!mobile()))f.style.transform='translateX(100%)';b.style.visibility='';document.documentElement.style.overflow=''}
  window.Tablo={open:open,close:close};
  fetch('${origin}/embed.js/theme?v='+encodeURIComponent(slug)).then(function(r){return r.json()}).catch(function(){return {}}).then(build);
})();`;
  return new Response(js, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=300" } });
}
