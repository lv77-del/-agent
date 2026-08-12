const { chromium } = require("playwright");
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>m.type()==="error"&&errors.push(m.text()));
 await page.goto("http://127.0.0.1:3000",{waitUntil:"networkidle"});
 const shortcut=await page.getByRole("link",{name:"团队与云端"}).isVisible();
 await page.getByRole("link",{name:"团队与云端"}).click();
 await page.waitForURL("**/team");
 await page.waitForFunction(()=>document.querySelector(".team-title h1")?.textContent!=="正在载入工作区…");
 const title=await page.locator(".team-title h1").textContent();
 const localMode=await page.getByText("本地兼容模式").isVisible();
 const inviteForm=await page.getByRole("button",{name:"发送邀请"}).isVisible();
 await page.setViewportSize({width:390,height:844});
 const mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
 console.log(JSON.stringify({shortcut,title,localMode,inviteForm,mobileOverflow,errors},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
