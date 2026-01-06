
from playwright.sync_api import Page, expect, sync_playwright

def verify_landing_dark_mode_classes(page: Page):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto("http://localhost:4173/")

    # 1. Toggle Dark Mode
    toggle_btn = page.locator("button:has(svg.lucide-moon)").first
    toggle_btn.click()
    page.wait_for_timeout(500)

    # 2. Verify HTML has 'dark' class
    html_class = page.eval_on_selector("html", "el => el.className")
    print(f"HTML Class: {html_class}")
    if "dark" not in html_class:
        raise AssertionError("HTML element missing 'dark' class")

    # 3. Verify Section has dark classes
    # We don't need to scroll to it to check the DOM attributes
    section_class = page.eval_on_selector("#mobile-why-aastha", "el => el.className")
    print(f"Section Class: {section_class}")

    if "dark:bg-slate-900" not in section_class:
         raise AssertionError("Section #mobile-why-aastha missing 'dark:bg-slate-900' class")

    print("SUCCESS: Classes are present.")

    # 4. Screenshot Hero (Top)
    page.screenshot(path="/home/jules/verification/dark_mode_hero.png")

if __name__ == "__main__":
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
      verify_landing_dark_mode_classes(page)
    finally:
      browser.close()
