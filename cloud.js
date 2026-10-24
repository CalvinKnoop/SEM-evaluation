"use strict";
// Supabase bridge. Does not run until the participant opts in.
(() => {
  const cfg = window.SUPABASE_CONFIG || {};
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test((cfg.url || '').trim())
      && typeof cfg.publishableKey === 'string' && cfg.publishableKey.length > 12;
  const client = configured && window.supabase?.createClient
    ? window.supabase.createClient(cfg.url.trim().replace(/\/$/,''),cfg.publishableKey.trim(),{
        auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false},
      })
    : null;
  let sessionJob = null;
  async function ensureSession(){
    if(!client) throw new Error('Supabase ist nicht eingerichtet oder die Bibliothek konnte nicht geladen werden.');
    if(!sessionJob){
      sessionJob=(async()=>{
        const {data,error} = await client.auth.getSession();
        if(error) throw error;
        if(data.session?.user?.id) return data.session.user;
        const res=await client.auth.signInAnonymously();
        if(res.error) throw res.error;
        if(!res.data.user) throw new Error('Anonyme Anmeldung fehlgeschlagen.');
        return res.data.user;
      })().catch(e=>{sessionJob=null;throw e;});
    }
    return sessionJob;
  }
  async function upload(record){
    await ensureSession();
    const row={
      annotation_id:String(record.annotation_id),
      participant_id:String(record.participant_id),
      session_id:String(record.session_id),
      schema_version:record.schema_version,
      app_version:record.app_version,
      mode:record.mode,
      image_id:record.image_id,
      image_file:record.image_file,
      image_version:record.image_version || 'demo-v01',
      width:record.width, height:record.height,
      started_at:record.started_at, submitted_at:record.submitted_at,
      duration_seconds:record.duration_seconds,
      overlap_rule:record.overlap_rule,
      coordinate_system:record.coordinate_system,
      circles:record.circles
    };
    const {error}=await client.from('sem_annotations').insert(row);
    if(error) throw error;
  }
  window.SEMCloud={isConfigured:!!client,ensureSession,upload};
})();
