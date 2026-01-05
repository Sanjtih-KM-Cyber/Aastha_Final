
from playwright.sync_api import Page, expect, sync_playwright

def verify_landing_dark_mode(page: Page):
    # Navigate to the landing page
    # Assuming client is running on localhost:4173 (preview)
    page.goto("http://localhost:4173/")

    # Wait for the page to load
    expect(page.get_by_text("Peace in your Pocket")).to_be_visible(timeout=10000)

    # Click the dark mode toggle (Moon icon)
    # The toggle is in the navbar.
    # We can select it by role 'button' and check for the icon inside or just try to click it.
    # It's the button with the Moon icon (when light) or Sun (when dark).
    # Since we start in light mode (default), look for the button containing the Moon.

    # We can use a CSS selector for the toggle button since it has a specific aria or icon.
    # Based on Navbar.tsx:
    # <button onClick={toggleTheme} ...> {isDark ? <Sun ... /> : <Moon ... />} </button>

    # Let's find the button in the desktop nav (hidden md:flex)
    # Selector: .hidden.md\\:flex button >> has(svg.lucide-moon)
    # Or just click any button with a Moon icon.

    page.locator("button:has(svg.lucide-moon)").first.click()

    # Wait for transition
    page.wait_for_timeout(1000)

    # Scroll to "Peace in your Pocket" (MobileExperience section)
    # id="mobile-why-aastha"
    mobile_section = page.locator("#mobile-why-aastha")
    mobile_section.scroll_into_view_if_needed()

    # Take a screenshot of the section
    page.screenshot(path="/home/jules/verification/dark_mode_landing.png")

    # Assert that the section has the dark background class
    # Note: Tailwind 'dark:bg-slate-900' applies when 'dark' class is on html.
    # We can check if the computed background color is slate-900 (#0f172a)
    # Slate-900 is rgb(15, 23, 42)

    bg_color = mobile_section.evaluate("el => getComputedStyle(el).backgroundColor")
    print(f"Computed Background Color: {bg_color}")

    if "rgb(15, 23, 42)" in bg_color:
        print("SUCCESS: Dark mode background applied.")
    else:
        print(f"FAILURE: Expected dark background, got {bg_color}")

if __name__ == "__main__":
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
      verify_landing_dark_mode(page)
    finally:
      browser.close()
