import asyncio,os
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(headless=True); c=await b.new_context(viewport={"width":1280,"height":1800}); pg=await c.new_page()
    await pg.goto("http://localhost:8080"); await pg.evaluate("v=>localStorage.setItem('actes_pw',v)",os.environ["DASHBOARD_PASSWORD"])
    await pg.goto("http://localhost:8080"); await pg.get_by_role("button",name="المسار").click(); await pg.wait_for_timeout(2500)
    btn=pg.locator("input[aria-label='اسم الزر'][value='طلب عرض سعر']").first
    await btn.locator("xpath=../../..").get_by_text("إضافة خطوة بعد هذا الزر").click()
    ed=pg.locator(".border-dashed").first
    await ed.locator("textarea").fill("تجربة: عندك فاتورة كهرباء؟")
    await ed.get_by_label("اسم الزر").first.fill("نعم عندي")
    await ed.get_by_text("حفظ الخطوة").click(); await pg.wait_for_timeout(3000)
    card=pg.get_by_text("تجربة: عندك فاتورة كهرباء؟").first
    await card.scroll_into_view_if_needed(); await pg.screenshot(path="step.png")
    print("visible", await card.is_visible())
    await b.close()
asyncio.run(main())
