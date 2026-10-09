import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {initializeApp,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {createTrashHandler} from '../../api/trash.mjs';
initializeApp({credential:cert(JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS,'utf8'))),projectId:'bee-production-e1058'});
const auth=getAuth(),db=getFirestore(),id='trash-test-'+randomUUID(),uids=[],paths=new Set();
const handler=createTrashHandler({auth,db});
async function member(role){const u=await auth.createUser({email:role+'-'+id+'@example.com',password:randomUUID()+'Aa1!'});uids.push(u.uid);await put('app_users',u.uid,{id:u.uid,role,full_name:'Temporary '+role,disabled:false});return {uid:u.uid,token:await token(u.uid)};}
async function token(uid){const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyDUVCG5IX9nyWRKtbcHWDp5b0c9oJZqHWs',{method:'POST',headers:{'Content-Type':'application/json',Referer:'https://siaa-ten.vercel.app/'},body:JSON.stringify({token:await auth.createCustomToken(uid),returnSecureToken:true})});const data=await r.json();assert.ok(r.ok);return data.idToken;}
async function put(c,k,data){paths.add(c+'/'+k);await db.collection(c).doc(k).set(data);}
async function call(user,body,status=200){const res={setHeader(){},status(n){this.code=n;return this;},json(data){this.data=data;return this;},end(){return this;}};await handler({method:'POST',headers:{authorization:'Bearer '+user.token},body},res);assert.equal(res.code,status,JSON.stringify(res.data));return res.data;}
try{
 const admin=await member('admin'),pm=await member('project_manager'),editor=await member('editor');
 await put('projects',id,{id,name:'Temporary project',pm:pm.uid,access_ids:[pm.uid,editor.uid],client_id:'test-client'});
 await put('client_projects',id,{id,name:'Temporary project',client_id:'test-client'});
 await put('assets',id,{id,project_id:id,asset_title:'Temporary asset',access_ids:[pm.uid,editor.uid],current_version_id:id});
 await put('asset_versions',id,{id,project_id:id,asset_id:id,version_number:4,status:'Approved',approval_id:'APR-'+id,access_ids:[pm.uid,editor.uid]});
 await put('client_assets',id,{id,project_id:id,client_id:'test-client',reader_ids:[pm.uid,'test-client'],status:'Approved'});
 await put('comments',id,{id,project_id:id,asset_id:id,message:'Keep history',reader_ids:[pm.uid,'test-client']});
 await put('resources',id,{id,project_id:id,cost:750,access_ids:[pm.uid]});
 await call(editor,{action:'list',type:'project'},403);
 await call(pm,{action:'list',type:'user'},403);
 await call(admin,{action:'delete',type:'user',id:admin.uid},403);
 await put('projects',id+'-other',{id:id+'-other',name:'Other project',pm:'another-pm',access_ids:[]});
 await call(pm,{action:'delete',type:'project',id:id+'-other'},403);
 await call(pm,{action:'delete',type:'asset',id},403);
 await call(pm,{action:'list',type:'asset'},403);
 await call(admin,{action:'delete',type:'asset',id});
 assert.equal((await db.collection('assets').doc(id).get()).exists,false);
 let row=(await call(admin,{action:'list',type:'asset'})).items.find(x=>x.item_id===id);assert.ok(row);
 await call(pm,{action:'purge',type:'asset',trash_id:row.id},403);
 await call(pm,{action:'recover',type:'asset',trash_id:row.id},403);
 await call(admin,{action:'recover',type:'asset',trash_id:row.id});
 assert.equal((await db.collection('asset_versions').doc(id).get()).data().version_number,4);
 assert.equal((await db.collection('asset_versions').doc(id).get()).data().status,'Approved');
 await call(pm,{action:'delete',type:'project',id},403);
 await call(admin,{action:'delete',type:'project',id});
 for(const path of ['projects','client_projects','assets','asset_versions','client_assets','comments','resources'])assert.equal((await db.collection(path).doc(id).get()).exists,false,path);
 row=(await call(admin,{action:'list',type:'project'})).items.find(x=>x.item_id===id);assert.ok(row);
 await call(pm,{action:'recover',type:'project',trash_id:row.id},403);
 await call(admin,{action:'recover',type:'project',trash_id:row.id});
 assert.equal((await db.collection('resources').doc(id).get()).data().cost,750);
 assert.equal((await db.collection('comments').doc(id).get()).data().message,'Keep history');
 await call(admin,{action:'delete',type:'user',id:editor.uid});assert.equal((await auth.getUser(editor.uid)).disabled,true);
 await call(editor,{action:'list',type:'asset'},401);
 row=(await call(admin,{action:'list',type:'user'})).items.find(x=>x.item_id===editor.uid);assert.ok(row);assert.equal('item_data' in row,false);
 await call(admin,{action:'recover',type:'user',trash_id:row.id});assert.equal((await auth.getUser(editor.uid)).disabled,false);
 await call(admin,{action:'delete',type:'user',id:editor.uid});row=(await call(admin,{action:'list',type:'user'})).items.find(x=>x.item_id===editor.uid);await call(admin,{action:'purge',type:'user',trash_id:row.id});await assert.rejects(auth.getUser(editor.uid));
 console.log('PASS: Admin-only project/asset Trash, full recovery, v4 approval preserved, disabled user access, account recovery, and permanent deletion.');
}finally{
 for(const path of paths)await db.doc(path).delete();
 for(const uid of uids)try{await auth.deleteUser(uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
 for(const d of (await db.collection('app_trash').get()).docs){if(d.data().item_id===id||uids.includes(d.data().item_id)){await db.recursiveDelete(d.ref);}}
 for(const d of (await db.collection('audit_logs').get()).docs){if(uids.includes(d.data().user_id))await d.ref.delete();}
 console.log('Temporary Trash test fixtures removed.');
}
