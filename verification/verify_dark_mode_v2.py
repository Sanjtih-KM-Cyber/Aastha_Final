
from playwright.sync_api import Page, expect, sync_playwright

def verify_landing_dark_mode(page: Page):
    # Set viewport
    page.set_viewport_size({"width": 1280, "height": 800})

    page.goto("http://localhost:4173/")

    # Click dark mode toggle
    page.locator("button:has(svg.lucide-moon)").first.click()
    page.wait_for_timeout(500) # Wait for class application

    # Scroll to section
    section = page.locator("#mobile-why-aastha")
    section.scroll_into_view_if_needed()

    # Wait a bit for potential transitions
    page.wait_for_timeout(500)

    # Check background color
    bg_color = section.evaluate("el => getComputedStyle(el).backgroundColor")
    print(f"Computed Background Color: {bg_color}")

    page.screenshot(path="/home/jules/verification/dark_mode_landing_v2.png")

    if "rgb(15, 23, 42)" in bg_color: # slate-900
        print("SUCCESS: Dark mode background applied.")
    else:
        print(f"FAILURE: Expected dark background (rgb(15, 23, 42)), got {bg_color}")
        raise AssertionError("Dark mode not applied")

if __name__ == "__main__":
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
      verify_landing_dark_mode(page)
    finally:
      browser.close()
