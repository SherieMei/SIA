import { randomUUID, randomBytes } from 'node:crypto';
const failure = (message, status = 400) => Object.assign(new Error(message), { status });
const clean = data => Object.fromEntries(Object.entries(data).filter(([k]) => !['password','password_hash','salt'].includes(k)));
const projectCollections = ['client_projects','assets','client_assets','asset_versions','comments','resources','editor_sequences','animation_shot_progress','animation_shot_workflow','notifications'];
export function createTrashHandler({ auth, db }) {
  return async (req,res) => {
    res.setHeader('Cache-Control','no-store');
    const origin=req.headers.origin;
    if(['https://siaa-ten.vercel.app','https://siaa-20635.web.app'].includes(origin)){
      res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
      res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
    }
    if(req.method==='OPTIONS')return res.status(204).end();
    if(req.method!=='POST')return res.status(405).json({success:false,error:'Use POST.'});
    try {
      const bearer=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];if(!bearer)throw failure('Sign in first.',401);
      let token;try{token=await auth.verifyIdToken(bearer,true);}catch{throw failure('Sign in again.',401);}
      const me=(await db.collection('app_users').doc(token.uid).get()).data();
      if(!me||me.disabled||!['admin','project_manager'].includes(me.role)||(me.verification_required&&!token.email_verified))throw failure('Access denied.',403);
      const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
      const {action,type}=body;if(!['user','project','asset'].includes(type))throw failure('Invalid item type.');
      if(type==='user'&&me.role!=='admin')throw failure('Only Admin can manage deleted users.',403);
      const permitted = async projectId => {
        if(me.role==='admin')return;
        const project=(await db.collection('projects').doc(String(projectId)).get()).data();
        if(!project||project.pm!==token.uid||!project.access_ids?.includes(token.uid))throw failure('Only the assigned project manager can manage this item.',403);
      };
      const stamp=()=>new Date().toISOString();
      const log=(batch,record,verb)=>{
        const id='au'+randomUUID();batch.set(db.collection('audit_logs').doc(id),{id,user_id:token.uid,by:me.full_name,action:verb,entity:type==='user'?'User':type==='asset'?'Asset #'+record.item_id:'Project',entity_type:type==='user'?'system':'project',project_id:record.project_id||record.item_id,detail:record.name,created_at:stamp(),access_ids:record.access_ids||[]});
      };
      if(action==='list'){
        let rows=(await db.collection('app_trash').where('item_type','==',type).get()).docs.map(d=>({id:d.id,...d.data()}));
        if(me.role!=='admin'){
          if(type==='project')rows=rows.filter(r=>r.manager_id===token.uid&&r.access_ids?.includes(token.uid));
          else{const allowed=[];for(const row of rows){try{await permitted(row.project_id);allowed.push(row);}catch{}}rows=allowed;}
        }
        return res.status(200).json({success:true,items:rows.map(({item_data,...r})=>r).sort((a,b)=>b.deleted_at.localeCompare(a.deleted_at))});
      }
      if(action==='delete'){
        const id=String(body.id||'');if(!id||id.includes('/'))throw failure('Invalid item.');
        const collection=type==='user'?'app_users':type==='project'?'projects':'assets';
        const source=db.collection(collection).doc(id);const snapshot=await source.get();if(!snapshot.exists)throw failure('Item not found.',404);
        const data=snapshot.data();if(type==='user'&&id===token.uid)throw failure('You cannot delete your own account.',403);
        if(type==='user'&&data.disabled)throw failure('This user is already removed.');
        if(type!=='user')await permitted(type==='project'?id:data.project_id);
        const trash=db.collection('app_trash').doc(randomUUID());
        const record={id:trash.id,item_type:type,item_id:id,name:data.full_name||data.name||data.asset_title||id,deleted_at:stamp(),deleted_by:token.uid,project_id:type==='project'?id:data.project_id||'',manager_id:type==='project'?data.pm||'':'',access_ids:data.access_ids||[],item_data:clean(data)};
        if(type==='user'){
          // Retain Firebase identity so recovery preserves the member's password and history.
          await auth.updateUser(id,{disabled:true});await auth.revokeRefreshTokens(id);
          const batch=db.batch();batch.set(trash,record);batch.update(source,{disabled:true});log(batch,record,'Deleted');
          try{await batch.commit();}catch(e){await auth.updateUser(id,{disabled:false});throw e;}
        }else{
          const docs=new Map([[source.path,snapshot]]);
          if(type==='project'){
            const projection=await db.collection('client_projects').doc(id).get();if(projection.exists)docs.set(projection.ref.path,projection);
            for(const name of projectCollections){for(const d of (await db.collection(name).where('project_id','==',id).get()).docs)docs.set(d.ref.path,d);}
          }else{
            for(const name of ['asset_versions','comments','animation_shot_progress','animation_shot_workflow'])for(const d of (await db.collection(name).where('asset_id','==',data.id).get()).docs)docs.set(d.ref.path,d);
            const projection=await db.collection('client_assets').doc(id).get();if(projection.exists)docs.set(projection.ref.path,projection);
          }
          if(docs.size>240)throw failure('This item has too many records for safe recovery in one operation. No data was removed.',409);
          await db.runTransaction(async tx=>{
            const current=await tx.get(source);if(!current.exists)throw failure('Item already removed.',409);
            const snapshots=[];for(const d of docs.values())snapshots.push(await tx.get(d.ref));
            tx.set(trash,record);for(const d of snapshots){if(!d.exists)continue;tx.set(trash.collection('records').doc(Buffer.from(d.ref.path).toString('base64url')),{path:d.ref.path,data:d.data()});tx.delete(d.ref);}log(tx,record,'Deleted');
          });
        }
        return res.status(200).json({success:true,message:'Moved to Trash.'});
      }
      if(!['recover','purge'].includes(action))throw failure('Invalid action.');
      const trashId=String(body.trash_id||'');if(!trashId||trashId.includes('/'))throw failure('Invalid Trash item.');
      const trash=db.collection('app_trash').doc(trashId),saved=await trash.get();if(!saved.exists)throw failure('Trash item not found.',404);
      const record=saved.data();if(record.item_type!==type)throw failure('Invalid Trash item.');
      if(action==='purge'&&me.role!=='admin')throw failure('Only Admin can permanently delete items.',403);
      if(me.role!=='admin'){
        if(type==='project'){if(record.manager_id!==token.uid||!record.access_ids?.includes(token.uid))throw failure('Access denied.',403);}
        else await permitted(record.project_id);
      }
      if(type==='user'){
        if(action==='recover'){
          let account;try{account=await auth.getUser(record.item_id);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
          let data=clean(record.item_data);
          if(!account){
            account=await auth.createUser({uid:record.item_id,email:data.email,displayName:data.full_name,password:randomBytes(32).toString('base64url'),disabled:true});
            data={...data,verification_required:true,email_verified:false,invitation_status:'failed'};
          }
          const batch=db.batch();batch.set(db.collection('app_users').doc(record.item_id),{...data,id:record.item_id,disabled:false});batch.delete(trash);log(batch,record,'Restored');await auth.updateUser(account.uid,{disabled:false});try{await batch.commit();}catch(e){await auth.updateUser(account.uid,{disabled:true});throw e;}
        }else{
          try{await auth.deleteUser(record.item_id);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
          const batch=db.batch();batch.delete(db.collection('app_users').doc(record.item_id));batch.delete(db.collection('team_invitations').doc(record.item_id));batch.delete(trash);log(batch,record,'Permanently deleted');await batch.commit();
        }
      }else{
        const docs=(await trash.collection('records').get()).docs;if(docs.length>240)throw failure('Too many records.',409);
        await db.runTransaction(async tx=>{
          if(!(await tx.get(trash)).exists)throw failure('Trash item already processed.',409);
          let currentProject;
          if(action==='recover'){
            if(type==='asset'){ currentProject=(await tx.get(db.collection('projects').doc(record.project_id))).data();if(!currentProject)throw failure('Recover the project first.',409); }
            for(const d of docs){if((await tx.get(db.doc(d.data().path))).exists)throw failure('An active record already uses this ID. Recovery was cancelled.',409);}
          }
          for(const d of docs){if(action==='recover'){let restored=d.data().data;if(currentProject){restored={...restored};if('access_ids' in restored)restored.access_ids=currentProject.access_ids;if('reader_ids' in restored)restored.reader_ids=restored.reader_ids.length===1?[currentProject.client_id].filter(Boolean):[...currentProject.access_ids,currentProject.client_id].filter(Boolean);if('client_id' in restored)restored.client_id=currentProject.client_id;}tx.set(db.doc(d.data().path),restored);}tx.delete(d.ref);}tx.delete(trash);log(tx,record,action==='recover'?'Restored':'Permanently deleted');
        });
      }
      return res.status(200).json({success:true,message:action==='recover'?'Recovered successfully.':'Permanently deleted.'});
    }catch(e){return res.status(e.status||500).json({success:false,error:e.status?e.message:'Unable to process Trash. Please retry.'});}
  };
}
let cached;
export default async function handler(req,res){
  try{
    if(!cached){const {getApps,initializeApp,cert}=await import('firebase-admin/app');const {getAuth}=await import('firebase-admin/auth');const {getFirestore}=await import('firebase-admin/firestore');
      const key=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}');if(key.project_id!=='siaa-20635')throw Error();
      const app=getApps().find(a=>a.name==='trash')||initializeApp({credential:cert(key)},'trash');cached=createTrashHandler({auth:getAuth(app),db:getFirestore(app)});
    }return cached(req,res);
  }catch{return res.status(503).json({success:false,error:'Trash service is not configured.'});}
}
