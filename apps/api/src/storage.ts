export interface EvidenceStorage {
  list(prefix:string,options:{limit:number}):Promise<{data:{name:string;id?:string|null}[]|null;error:unknown}>;
  remove(paths:string[]):Promise<{error:unknown}>;
}
export async function cleanupEvidence(storage:EvidenceStorage,user:string,caseId:string):Promise<void> {
  let requests=0;
  const visit=async (prefix:string,depth:number):Promise<void> => {
    if (depth>8) throw new Error('CLEANUP_INCOMPLETE');
    for (;;) {
      if (++requests>1000) throw new Error('CLEANUP_INCOMPLETE');
      const {data,error}=await storage.list(prefix,{limit:100});
      if (error) throw new Error('CLEANUP_FAILED');
      if (!data?.length) return;
      const files=data.filter(o => o.id!=null);
      if (files.length) {
        const result=await storage.remove(files.map(o => `${prefix}/${o.name}`));
        if (result.error) throw new Error('CLEANUP_FAILED');
      }
      for (const folder of data.filter(o => o.id==null)) {
        if (!folder.name || folder.name==='.' || folder.name==='..' || folder.name.includes('/')) throw new Error('CLEANUP_INCOMPLETE');
        await visit(`${prefix}/${folder.name}`,depth+1);
      }
    }
  };
  await visit(`${user}/${caseId}`,0);
}
