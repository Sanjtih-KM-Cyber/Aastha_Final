from playwright.sync_api import sync_playwright
import time

def dump_html():
    with sync_playwright() as p:
        iphone = p.devices['iPhone 14 Pro Max']
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(**iphone)
        page = context.new_page()

        print("Navigating...")
        page.goto("http://localhost:3000")

        try:
            page.wait_for_selector("text=Diary", timeout=10000)
            print("Dashboard found. Opening Diary...")
            page.click("text=Diary")
            time.sleep(3) # Wait for animation

            print("Dumping HTML...")
            with open("diary_dump.html", "w", encoding="utf-8") as f:
                f.write(page.content())
            print("HTML dumped to diary_dump.html")

            page.screenshot(path="debug_diary_view.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="debug_fail.png")

        finally:
            browser.close()

if __name__ == "__main__":
    dump_html()
