export type ResearchSourceCard={id:string;title:string;url?:string;summary:string;sourceType:string;publishedAt?:string;metadata?:Record<string,unknown>};
export async function runResearchSkill(input:{keywords:string[];materials?:unknown[]}):Promise<ResearchSourceCard[]>{
 if(!process.env.RESEARCH_SKILL_URL)throw new Error("RESEARCH_SKILL_URL 尚未配置，请先提供 Skill 链接和调用协议");
 const r=await fetch(process.env.RESEARCH_SKILL_URL,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${process.env.RESEARCH_SKILL_TOKEN||""}`},body:JSON.stringify(input)});
 if(!r.ok)throw new Error(`信息搜集 Skill 请求失败：${r.status}`);
 const data=await r.json();return Array.isArray(data)?data:data.sourceCards||[];
}
