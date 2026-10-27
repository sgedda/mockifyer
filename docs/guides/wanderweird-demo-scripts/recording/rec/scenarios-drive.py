# Records the 4.14 clip: opens scripts/sbs/scenarios.html (served on :8099) in Chrome on $DISPLAY (default :13), switches the wanderweird-demo lane in the real dashboard Settings UI and re-opens Discover in the app. Usage: python3 rec/scenarios-drive.py take20
import asyncio,subprocess,sys,os
from playwright.async_api import async_playwright
TAKE=sys.argv[1]; OUT=f"{TAKE}.mp4"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path="/usr/bin/google-chrome",headless=False,
      args=["--window-position=0,0","--window-size=1920,1200","--no-first-run","--disable-infobars"],
      env={**os.environ,"DISPLAY":os.environ.get("DISPLAY",":13")})
    ctx=await b.new_context(no_viewport=True); pg=await ctx.new_page()
    await pg.goto("http://127.0.0.1:8099/scenarios.html"); await pg.wait_for_timeout(15000)
    app=pg.frame_locator("#app"); d=pg.frame_locator("#d")
    ins=app.locator("input")
    if await ins.count()>=2:
      await ins.nth(0).fill("wanderer"); await ins.nth(1).fill("wanderer"); await app.get_by_text("Sign in").last.click(); await pg.wait_for_timeout(6000)
    await app.get_by_text("Discover").last.click(); await pg.wait_for_timeout(4000)
    card=d.locator("div").filter(has_text="wanderweird-demo").filter(has=d.locator("select")).last
    sel=card.locator("select").first
    await sel.scroll_into_view_if_needed(); await pg.evaluate("()=>0")
    await d.locator("body").evaluate("()=>window.scrollBy(0,-120)")
    async def cap(a,b=""):
      await pg.evaluate("([a,b])=>{document.getElementById('cap').textContent=a;document.getElementById('sub').textContent=b}",[a,b])
    rec=subprocess.Popen(["setsid","ffmpeg","-y","-loglevel","error","-f","x11grab","-video_size","1920x1200","-framerate","5","-i",os.environ.get("DISPLAY",":13"),"-t","60","-vf","scale=1280:800",OUT])
    await cap("Scenario guide-demo-2: Atlantis shows 99° · wind 6","client lane wanderweird-demo → guide-demo-2"); await pg.wait_for_timeout(4000)
    async def switch(s,txt):
      await cap(f"Settings → Client lanes: wanderweird-demo → {s}",f"PUT /api/client-lanes/wanderweird-demo/scenario {{\"scenario\":\"{s}\"}}")
      await sel.hover(); await pg.wait_for_timeout(1200); await sel.select_option(s); await pg.wait_for_timeout(2000)
      await app.get_by_text("Trips").last.click(); await pg.wait_for_timeout(900)
      await app.get_by_text("Discover").last.click(); await pg.wait_for_timeout(2500)
      await cap(f"App now on {s}: {txt}","no restart, no code change: the next request reads the other scenario"); await pg.wait_for_timeout(4000)
    await switch("heatwave","44° · wind 3")
    await switch("rainy-weekend","11° · wind 52")
    await switch("guide-demo-2","back to 99° · wind 6")
    rec.send_signal(2); rec.wait(); await b.close()
asyncio.run(main())
