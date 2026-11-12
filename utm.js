/* Osso a Osso: guarda os parâmetros do anúncio (UTMs) quando a pessoa chega
   e os devolve nos links de pagamento da Kiwify, para a UTMify saber de qual
   anúncio veio cada venda, mesmo depois de a pessoa criar a conta no app. */
(function(){
  var KEYS=["utm_source","utm_medium","utm_campaign","utm_content","utm_term","utm_id","src","fbclid"];
  var STORE="osso_utm", MAX_DIAS=30;
  function ler(){try{var o=JSON.parse(localStorage.getItem(STORE)||"null");if(o&&o.p&&Date.now()-o.t<MAX_DIAS*864e5)return o.p;}catch(e){}return null;}
  function gravar(p){try{localStorage.setItem(STORE,JSON.stringify({t:Date.now(),p:p}));}catch(e){}}
  // 1) chegou com UTMs na URL? guarda (o último anúncio clicado vale)
  try{var q=new URLSearchParams(location.search),achou={},tem=false;
    KEYS.forEach(function(k){var v=q.get(k);if(v){achou[k]=v;tem=true;}});
    if(tem)gravar(achou);}catch(e){}
  // 2) acrescenta as UTMs guardadas a um link (sem sobrescrever as que já existem)
  function decorar(href){var p=ler();if(!p||!href)return href;
    try{var u=new URL(href,location.href);Object.keys(p).forEach(function(k){if(!u.searchParams.has(k))u.searchParams.set(k,p[k]);});return u.toString();}catch(e){return href;}}
  window.ossoUTM=decorar;
  // 3) qualquer clique em link da Kiwify (inclusive criado depois) sai com as UTMs
  document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href*="kiwify.com.br"]');if(a)a.href=decorar(a.getAttribute("href"));},true);
})();
