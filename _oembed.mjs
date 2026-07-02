const ids="91rAJLbb4tc C3f3iBC9NAU FQmo_BTqzx0 svofVazjTKg oKpog0rbtTw C0IblGdhfRs Mz_GzXJMxFg E5qRcjO63Fk ehliCpcSSio uh1MlzqIZ-c Jh7DI2mtwes eO41v8hTvK8 e0dn60dwi84 fv2VFkKyal8 6coA_puXTaA CBZh1UfxuEk jxlATTdZbkM F0SNRCJq-aE zlmQmSBNtzE bmB3YrSxttc Ar19irawtM0 mYZKaMWJA8s JtUbxWvaRKM qiwPAcobG30 Wxcr0YnJT4A SCrAPTxXBAY HrQGSdRBwJs Nz7GGyMGjJY HE3EWVV_tLo O_hwTAPrfJI".split(' ');
const out=[];
for (const id of ids){
  try{
    const r=await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
    if(r.ok){ const j=await r.json(); out.push({id, title:j.title}); }
    else out.push({id, title:null, status:r.status});
  }catch(e){ out.push({id,title:null,err:e.message}); }
}
import('fs').then(fs=>fs.writeFileSync('_videos.json', JSON.stringify(out,null,2)));
console.log('ok:', out.filter(v=>v.title).length, '/', out.length);
out.forEach(v=>console.log(v.id, '|', v.title||('FAIL '+(v.status||v.err))));
