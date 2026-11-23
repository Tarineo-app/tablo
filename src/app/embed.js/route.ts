// Script à coller sur le site du club :
// <script src="https://VOTRE-DOMAINE/embed.js" data-venue="slug-du-club" async></script>
// Il ajoute un bouton flottant qui ouvre le widget dans une fenêtre par-dessus le site.

export async function GET(req: Request) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const js = `(function(){
  var s=document.currentScript||document.querySelector('script[data-venue]');
  if(!s||window.__tablo)return;window.__tablo=1;
  var slug=s.getAttribute('data-venue'),m=s.getAttribute('data-manager');
  var src='${origin}/w/'+encodeURIComponent(slug)+(m?'?m='+encodeURIComponent(m):'');
  fetch('${origin}/embed.js/theme?v='+encodeURIComponent(slug)).then(function(r){return r.json()}).catch(function(){return {}}).then(function(t){
    var b=document.createElement('button');b.type='button';b.textContent=t.fab||'Réserver un carré';
    b.style.cssText='position:fixed;right:20px;bottom:20px;z-index:2147483000;border:0;cursor:pointer;padding:15px 22px;font:800 15px system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.35);background:'+(t.btn||'#fff')+';color:'+(t.on||'#111')+';border-radius:'+(t.radius||'999px');
    var o=document.createElement('div');o.style.cssText='position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;padding:2vh 2vw';
    var f=document.createElement('iframe');f.title='Réservation';f.style.cssText='width:min(1180px,100%);height:min(860px,100%);border:0;border-radius:20px;background:#000';
    var x=document.createElement('button');x.type='button';x.setAttribute('aria-label','Fermer');x.textContent='✕';x.style.cssText='position:absolute;top:12px;right:16px;width:44px;height:44px;border-radius:50%;border:0;background:#fff;color:#111;font-size:18px;cursor:pointer';
    o.appendChild(f);o.appendChild(x);document.body.appendChild(o);document.body.appendChild(b);
    function open(){if(!f.src)f.src=src;o.style.display='flex';b.style.display='none';document.documentElement.style.overflow='hidden'}
    function close(){o.style.display='none';b.style.display='';document.documentElement.style.overflow=''}
    b.onclick=open;x.onclick=close;o.onclick=function(e){if(e.target===o)close()};
    document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
    if(window.innerWidth<700){f.style.borderRadius='0';o.style.padding='0';f.style.width='100%';f.style.height='100%'}
  });
})();`;
  return new Response(js, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=300" } });
}
