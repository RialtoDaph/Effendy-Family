// Local stand-in for Supabase so sign-in and invites can be clicked through without real email or data.
/* eslint-disable */
const http = require('http');
const uid = '11111111-1111-1111-1111-111111111111';
const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = () => Math.floor(Date.now() / 1000) + 86400;
const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'alex@example.test', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const session = () => ({ access_token: b({ alg: 'none' }) + '.' + b({ sub: uid, exp: exp(), role: 'authenticated' }) + '.x', refresh_token: 'stub', token_type: 'bearer', expires_in: 86400, expires_at: exp(), user });
const share = { money: true, goals: true, cal: true, docs: false, debts: false, remit: false };
const rows = {
  members: [{ id: uid, household_id: 'h1', display_name: 'Alex', email: 'alex@example.test', role: 'owner', avatar_bg: null, avatar_fg: null, sort: 1, share }, { id: '22222222-2222-2222-2222-222222222222', household_id: 'h1', display_name: 'Mira', email: 'mira@example.test', role: 'partner', avatar_bg: null, avatar_fg: null, sort: 2, share }],
  households: [{ id: 'h1', name: 'Morgan family', home_city: 'München', currency: 'EUR' }],
  subscriptions_billing: [{ seats: 4, plan: 'together', interval: 'month', status: 'trial', current_period_end: new Date(Date.now()+9e8).toISOString(), provider_ref: null }],
  invites: [],
};
const log = [];
const iso = (o) => new Date(Date.now() + o * 864e5).toISOString().slice(0, 10);
const m0 = iso(0).slice(0, 8) + '01', ym = iso(0).slice(0, 7);
const own = { owner_id: uid, visibility: 'family' };
const mon = (()=>{const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));return d.toISOString().slice(0,10)})();
const seed = {
  assets: [{id:'as1',name:'World ETF',icon:'trending-up',location:'Trade Republic',orig_currency:'EUR',orig_value:12000,value_eur:12000,note:null,...own},{id:'as2',name:'Tabungan BCA',icon:'piggy-bank',location:'Jakarta',orig_currency:'IDR',orig_value:50000000,value_eur:2776,note:null,...own}],
  career_steps: [{id:'cs1',plan:'Studio plan',title:'Business plan',status:'done',timing:'Q1',sort:0,...own},{id:'cs2',plan:'Studio plan',title:'First clients',status:'now',timing:null,sort:1,...own}],
  member_settings: [{member_id:uid,theme:'light',palette:'noir',default_visibility:{},notif:{},warn_pct:80,ef_months:6,learn_week_min:180,gym_week_goal:3,shift_wage:15}],
  events: [
    {id:'e1',kind:'shift',title:'Bar shift',date:iso(0),start_time:'18:00:00',end_time:'01:00:00',who:uid,remind_min:null,source:'manual',note:null,...own},
    {id:'e2',kind:'shift',title:'Bar shift',date:iso(2),start_time:'18:00:00',end_time:'02:00:00',who:uid,remind_min:null,source:'manual',note:null,...own},
    {id:'e3',kind:'shift',title:'Bar shift',date:iso(9),start_time:'18:00:00',end_time:'01:00:00',who:uid,remind_min:null,source:'manual',note:null,...own},
    {id:'e4',kind:'event',title:'Tax papers',date:iso(1),start_time:'15:00:00',end_time:null,who:'22222222-2222-2222-2222-222222222222',remind_min:60,source:'manual',note:null,...own},
    {id:'e5',kind:'event',title:'Family lunch',date:iso(3),start_time:null,end_time:null,who:null,remind_min:null,source:'manual',note:null,...own},
  ],
  week_priorities: [{id:'p1',week_start:mon,title:'Send the VAT pre-return',who:uid,done:false,sort:0,...own},{id:'p2',week_start:mon,title:'Book the Therme evening',who:null,done:true,sort:1,...own}],
  yearly_goals: [
    {id:'y1',year:+iso(0).slice(0,4),name:'AI studies: 30 ECTS this year',icon:'graduation-cap',target:30,unit:'ECTS',done:21,step:'6 study hours',who:uid,...own},
    {id:'y2',year:+iso(0).slice(0,4),name:'Atelier: 500 orders',icon:'scissors',target:500,unit:'orders',done:250,step:'10 orders',who:'22222222-2222-2222-2222-222222222222',...own},
    {id:'y3',year:+iso(0).slice(0,4),name:'45 date nights',icon:'heart',target:45,unit:'dates',done:33,step:'1 date night',who:null,...own},
  ],
  goal_progress: [{id:'gp1',goal_id:'y1',date:iso(0),amount:2,...own},{id:'gp2',goal_id:'y1',date:iso(-8),amount:1,...own},{id:'gp3',goal_id:'y1',date:iso(-15),amount:.2,...own}],
  learning_items: [{id:'l1',track:'Business & marketing',title:'Building a StoryBrand',type:'book',who:uid,pct:60,next:'chapter 8',...own},{id:'l2',track:'Finance & investing',title:'The Psychology of Money',type:'book',who:null,pct:100,next:null,...own}],
  learning_minutes: [0,7,14,21,28,35,42,49].map((d,i)=>({id:'lm'+i,date:iso(-d),minutes:[60,190,120,200,90,180,30,150][i],item_id:null,...own})),
  gym_sessions: [0,2,7,9,11,14,16,18,21,23,25].map((d,i)=>({id:'gs'+i,type:['Strength','Cardio','Class'][i%3],icon:'dumbbell',date:iso(-d),time:'07:30:00',...own})).concat([{id:'gs90',type:'Yoga',icon:'flower-2',date:iso(-1),time:null,owner_id:'22222222-2222-2222-2222-222222222222',visibility:'family'}]),
  journal_entries: [{id:'j1',date:iso(-1),text:'Tired after the lecture, but the ML stuff is finally clicking.',owner_id:uid,visibility:'private'}],
  date_ideas: [{id:'di1',name:'Altmühltal sunset walk',short:'Picnic on the Jura cliffs',icon:'mountain',cost:15,...own},{id:'di2',name:'Therme Bad Gögging',short:'Evening ticket for two',icon:'waves',cost:60,...own}],
  date_nights: [{id:'dn1',name:'Trattoria am Markt + castle walk',icon:'utensils',date:iso(-5),cost:64,rating:5,note:null,idea_id:null,event_id:null,...own},{id:'dn2',name:'Cinema, Ingolstadt',icon:'clapperboard',date:iso(-12),cost:32,rating:null,note:null,idea_id:null,event_id:null,...own},{id:'dn3',name:'Dinner at home',icon:'heart',date:iso(2),cost:25,rating:null,note:'Nasi timbel night',idea_id:null,event_id:null,...own}],

  categories: [['c1','Rent & utilities','house',1335,true],['c2','Groceries','shopping-cart',620,false],['c3','Online shopping','package',250,false],['c4','Eating out','utensils',200,false]].map(([id,name,icon,monthly_limit,is_fixed],i)=>({id,name,icon,monthly_limit,is_fixed,sort:i,...own})),
  incomes: [{id:'i1',name:'Gasthof zur Linde · salary',member_id:uid,kind:'Salary',monthly_amount:2150,...own},{id:'i2',name:'Alex Studio',member_id:uid,kind:'Business',monthly_amount:2600,...own}],
  recurring: [
    {id:'r1',name:'Rent · Wohnbau München',icon:'house',amount:-1050,category_id:'c1',paid_by:null,day_of_month:1,active:true,last_posted_month:ym,is_subscription:false,last_used_at:null,cancelled_on:null,...own},
    {id:'r2',name:'Shopify · Mira Atelier',icon:'laptop',amount:-39,category_id:null,paid_by:null,day_of_month:12,active:false,last_posted_month:null,is_subscription:false,last_used_at:null,cancelled_on:null,...own},
    {id:'r3',name:'Gasthof zur Linde · salary',icon:'banknote',amount:2150,category_id:null,paid_by:uid,day_of_month:28,active:true,last_posted_month:null,is_subscription:false,last_used_at:null,cancelled_on:null,...own},
    {id:'s1',name:'Netflix',icon:'tv',amount:-13.99,category_id:null,paid_by:null,day_of_month:5,active:true,last_posted_month:ym,is_subscription:true,last_used_at:iso(-3),cancelled_on:null,...own},
    {id:'s2',name:'DAZN',icon:'tv',amount:-34.99,category_id:null,paid_by:uid,day_of_month:9,active:true,last_posted_month:null,is_subscription:true,last_used_at:iso(-52),cancelled_on:null,...own},
    {id:'s4',name:'FitStudio',icon:'dumbbell',amount:-59.8,category_id:null,paid_by:null,day_of_month:1,active:true,last_posted_month:ym,is_subscription:true,last_used_at:iso(0),cancelled_on:null,...own},
    {id:'s3',name:'Disney+',icon:'tv',amount:-9.99,category_id:null,paid_by:null,day_of_month:15,active:false,last_posted_month:null,is_subscription:true,last_used_at:iso(-80),cancelled_on:iso(-10),...own},
  ],
  transactions: [{id:'t1',date:iso(0),amount:-46.8,payee:'REWE München',category_id:'c2',paid_by:null,source:'manual',receipt_file_id:null,created_at:new Date().toISOString(),...own},{id:'t2',date:iso(-1),amount:-180,payee:'Amazon.de',category_id:'c3',paid_by:uid,source:'manual',receipt_file_id:null,created_at:new Date().toISOString(),...own}],
  goals: [{id:'g1',name:'Emergency fund',icon:'life-buoy',target:18000,current:9450,monthly:500,deadline:null,is_emergency_fund:true,...own}],
  debts: [{id:'d1',name:'Furniture loan',icon:'sofa',lender:'Sparkasse Ratenkredit',balance:3840,original:6000,rate_pct:6.9,monthly_payment:160,member_id:null,...own},{id:'d2',name:'Phone financing',icon:'smartphone',lender:'o2',balance:456,original:912,rate_pct:0,monthly_payment:38,member_id:uid,...own}],
  debt_settings: [{strategy:'avalanche',extra_per_month:50}],
  remittances: [{id:'m1',to_name:'Mama · Alex’s side',eur:200,fee_eur:1.76,rate_idr_per_eur:18010,idr_received:3570302,provider:'Wise',purpose:'Monthly support',date:iso(-30),...own},{id:'m2',to_name:'Adik · school fees',eur:300,fee_eur:15,rate_idr_per_eur:17950,idr_received:5115750,provider:'Bank transfer',purpose:'School fees',date:iso(-90),...own}],
  fx_rates: [{idr_per_eur:18010,date:iso(-1)}],
  businesses: [{id:'b1',name:'Alex Studio',member_id:uid,vat_mode:'none',sort:1,...own},{id:'b2',name:'Mira Atelier',member_id:null,vat_mode:'quarterly',sort:2,...own}],
  business_months: [{id:'bm1',business_id:'b1',month:ym,revenue:2840,costs:410,tax_set_aside:690,file_id:'f1',...own},{id:'bm2',business_id:'b1',month:iso(-40).slice(0,7),revenue:2350,costs:395,tax_set_aside:560,file_id:null,...own},{id:'bm3',business_id:'b2',month:ym,revenue:1380,costs:520,tax_set_aside:240,file_id:null,...own}],
  files: [{id:'f1',storage_path:'x',name:'studio-report.pdf',kind:'business_report',mime:'application/pdf',size:1000,...own}],
  tax_deadlines: [{id:'x1',title:'VAT pre-return',due_date:iso(5),amount:486,kind:'vat',done:false,...own},{id:'x2',title:'Income tax return (joint)',due_date:iso(200),amount:null,kind:'return',done:false,...own}],
  tax_deductions: [{id:'y1',title:'Work laptop',amount:1200,year:+iso(0).slice(0,4),collected:true,...own},{id:'y2',title:'Commute',amount:840,year:+iso(0).slice(0,4),collected:false,...own}],
  tax_years: [{year:+iso(0).slice(0,4),refund_estimate:1180,note:null}],
};
http.createServer((req, res) => {
  const h = { 'access-control-allow-origin': req.headers.origin || '*', 'access-control-allow-headers': req.headers['access-control-request-headers'] || '*', 'access-control-allow-methods': '*', 'access-control-allow-credentials': 'true', 'content-type': 'application/json' };
  if (req.method === 'OPTIONS') { res.writeHead(204, h); return res.end(); }
  let body = ''; req.on('data', c => body += c); req.on('end', () => {
    const j = body ? JSON.parse(body) : {};
    const send = (s, o) => { res.writeHead(s, h); res.end(JSON.stringify(o)); };
    const url = req.url;
    if (url.startsWith('/__log')) return send(200, log);
    if (url.startsWith('/__plan')) { rows.subscriptions_billing = [{ ...rows.subscriptions_billing[0], plan: url.split('=')[1], seats: url.split('=')[1]==='together'?4:1 }]; return send(200, 'plan'); }
    if (url.startsWith('/__session')) return send(200, { ...session(), expires_at: exp() });
    if (url.startsWith('/__seed')) { Object.assign(rows, JSON.parse(JSON.stringify(seed))); return send(200, 'seeded'); }
    if (url.startsWith('/__clear')) { for (const k of Object.keys(seed)) delete rows[k]; return send(200, 'cleared'); }
    if (url.includes('/auth/v1/otp')) { log.push(['otp', j]); return send(200, {}); }
    if (url.includes('/auth/v1/verify')) { log.push(['verify', j]); return j.token === '123456' ? send(200, session()) : send(403, { code: 403, error_code: 'otp_expired', msg: 'bad' }); }
    if (url.includes('/rpc/invite_preview')) return send(200, j.p_token === 'rl_good' ? [{ household: 'Morgan family', inviter: 'Alex', invitee: 'Mira', role: 'partner', share }] : []);
    if (url.includes('/rpc/plan_choose')) { log.push(['plan', j]); rows.subscriptions_billing[0].plan = j.p_plan; rows.subscriptions_billing[0].interval = j.p_interval; rows.subscriptions_billing[0].seats = j.p_plan==='together'?4:1; return send(200, null); }
    if (url.includes('/rpc/create_invite')) { log.push(['create_invite', j]); rows.invites.push({ id: 'i1', name: j.p_name, used_at: null, expires_at: new Date(Date.now() + 6e8).toISOString() }); return send(200, 'rl_stubtoken'); }
    if (url.includes('/rpc/revoke_invite')) { rows.invites = []; return send(200, null); }
    if (url.includes('/rpc/set_member_share')) { log.push(['share', j]); return send(200, null); }
    if (url.includes('/rpc/')) return send(200, null);
    const name = (url.match(/\/rest\/v1\/([a-z_]+)/) || [])[1];
    const idm = (url.match(/[?&]id=eq\.([^&]+)/) || [])[1];
    if (name && req.method === 'POST') { (rows[name] = rows[name] || []).unshift({ owner_id: uid, visibility: 'family', ...j }); log.push(['insert', name, j]); return send(201, []); }
    if (name && req.method === 'PATCH') { (rows[name] || []).forEach((r) => { if (!idm || r.id === idm) Object.assign(r, j); }); log.push(['update', name, idm, j]); return send(200, []); }
    if (name && req.method === 'DELETE') { rows[name] = (rows[name] || []).filter((r) => r.id !== idm); return send(200, []); }
    if (name === 'subscriptions_billing' && url.includes('provider_ref')) return send(403, { code: '42501', message: 'permission denied' });
    let data = rows[name] || [];
    const fil = [...url.matchAll(/[?&]([a-z_]+)=eq\.([^&]+)/g)].filter(([, k]) => k !== 'id');
    for (const [, k, v] of fil) data = data.filter((r) => String(r[k]) === decodeURIComponent(v));
    const single = (req.headers.accept || '').includes('vnd.pgrst.object');
    send(200, single ? (data[0] ?? null) : data);
  });
}).listen(54399, () => console.log('stub on 54399'));
