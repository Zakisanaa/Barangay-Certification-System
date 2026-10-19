import {test,before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase,residentA,residentB,staff} from './helpers/database.mjs';
let db,asUser;
before(async()=>{({db,asUser}=await createTestDatabase());});
after(async()=>{await db?.close();});
beforeEach(async()=>{await db.exec('begin');});
afterEach(async()=>{await db.exec('rollback;reset role');});
async function rejected(work,pattern){await db.exec('savepoint denied');try{await assert.rejects(work,pattern);}finally{await db.exec('rollback to savepoint denied;release savepoint denied');}}
async function audit(query='',sort='newest',page=0,entity=null){return(await db.query("select public.office_record_list('audit',$1,$2,$3,$4) result",[page,query,sort,entity])).rows[0].result;}
async function auditStaff(permissions=['audit'],active=true){await asUser('','service_role');await db.exec('reset role');await db.query("update resident_profiles set role='staff' where id=$1",[residentB]);await db.query('insert into staff_access(user_id,permissions,active) values($1,$2,$3)',[residentB,permissions,active]);await asUser(residentB);}

test('superadmin audit list executes as authenticated while the internal helper stays private',async()=>{
 await asUser(staff);assert.ok((await audit()).total>0);
 const grants=(await db.query("select p.prosecdef,has_function_privilege('authenticated','public.require_staff_permission(text)','execute') helper from pg_proc p where p.oid='public.office_record_list(text,integer,text,text,text,text)'::regprocedure")).rows[0];
 assert.equal(grants.prosecdef,false);assert.equal(grants.helper,false);
 await rejected(()=>db.query("select public.require_staff_permission('audit')"),/permission denied for function/);
});

test('audit-only staff can search and sort all pages without receiving other private lists',async()=>{
 await db.query("insert into audit_log(actor_name,entity,record_id,action) select case when n%2=0 then 'Zed' else 'Amy' end,'office_settings','AUDIT-CHECK-'||lpad(n::text,2,'0'),'UPDATE' from generate_series(0,30)n");
 await auditStaff();const first=await audit('AUDIT-CHECK','name_asc'),next=await audit('AUDIT-CHECK','name_asc',1);
 assert.equal(first.total,31);assert.equal(first.rows.length,25);assert.equal(next.rows.length,6);assert.equal(first.rows[0].actor_name,'Amy');
 assert.equal((await audit('AUDIT-CHECK','name_desc')).rows[0].actor_name,'Zed');
 assert.equal((await audit('AUDIT-CHECK-30','oldest',0,'office_settings')).total,1);
 assert.equal((await audit('AUDIT-CHECK','newest',0,'resident_profiles')).total,0);
 await rejected(()=>db.query("select public.office_record_list('fees')"),/Fee record access required/);
});

test('residents, unrelated staff, inactive audit staff and anonymous callers cannot read audit history',async()=>{
 await asUser(residentA);await rejected(()=>audit(),/Audit history access required/);
 await auditStaff(['concerns']);await rejected(()=>audit(),/Audit history access required/);
 await asUser('','service_role');await db.exec('reset role');await db.query("update staff_access set permissions='{audit}',active=false where user_id=$1",[residentB]);
 await asUser(residentB);await rejected(()=>audit(),/Audit history access required/);
 await asUser('','anon');await rejected(()=>audit(),/permission denied/);
});

test('confirmed auth email changes synchronize resident and staff profiles and preserve staff access',async()=>{
 for(const id of [residentA,staff]){
  const address=id===staff?'changed-staff@example.test':'changed-resident@example.test';
  await db.query('update auth.users set email=$1 where id=$2',[address,id]);
  assert.equal((await db.query('select email from resident_profiles where id=$1',[id])).rows[0].email,address);
 }
 await asUser(staff);assert.ok((await audit()).total>0);
 await rejected(()=>db.query("update resident_profiles set email='unconfirmed@example.test' where id=$1",[staff]),/permission denied/);
});
