const metrics = [{label:'Bookings today',value:'—'},{label:'Active walkers',value:'—'},{label:'Pending reviews',value:'—'}];
export default function AdminHome() {
  return <main style={{fontFamily:'Arial,sans-serif',padding:32,maxWidth:1100,margin:'auto'}}>
    <h1>DOJO WALK Admin</h1><p>Operations overview</p>
    <section style={{display:'flex',gap:16,flexWrap:'wrap',marginTop:24}}>{metrics.map(x=><article key={x.label} style={{border:'1px solid #ddd',borderRadius:12,padding:24,minWidth:190}}><p>{x.label}</p><strong style={{fontSize:32}}>{x.value}</strong></article>)}</section>
    <p style={{marginTop:32,color:'#777'}}>Connect Firebase and enforce server-side admin role claims before exposing this dashboard.</p>
  </main>;
}
