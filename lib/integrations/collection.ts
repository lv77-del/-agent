export type CollectedArticle={externalId?:string;title:string;body:string;sourceName:string;sourceUrl?:string;publishedAt?:string;readCount:number;likeCount:number;wowCount:number};
export async function collectWechatArticles(input:{keywords:string[];limit:number;dateRangeDays:number}):Promise<CollectedArticle[]>{
 if(!process.env.WECHAT_COLLECTION_API_URL)throw new Error("微信公众号采集 API 尚未配置");
 const r=await fetch(process.env.WECHAT_COLLECTION_API_URL,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${process.env.WECHAT_COLLECTION_API_KEY||""}`},body:JSON.stringify(input)});
 if(!r.ok)throw new Error(`公众号采集接口请求失败：${r.status}`);
 const data=await r.json();return Array.isArray(data)?data:data.articles||[];
}
