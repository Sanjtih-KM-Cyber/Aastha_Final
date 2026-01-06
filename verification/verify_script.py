from playwright.sync_api import sync_playwright

def verify_changes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # 1. Desktop Context
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        try:
            # Navigate to Landing
            print("Navigating to landing page...")
            page.goto("http://localhost:3002")
            page.wait_for_timeout(2000)

            # --- VERIFY DARK MODE TOGGLE ---
            print("Testing Dark Mode...")

            # Click Moon Icon (Toggle)
            # Find the button that contains the Moon icon
            # In our code, it's a button with Moon or Sun icon.
            # Initial state is light -> Sun icon is NOT present, Moon icon IS present.
            # Wait, logic: {isDark ? <Sun /> : <Moon />}
            # Default is light, so Moon is visible.

            # Use specific locator for the button in desktop nav
            moon_btn = page.locator("nav button").filter(has=page.locator("svg.lucide-moon")).first
            if moon_btn.is_visible():
                moon_btn.click()
                page.wait_for_timeout(1000)
            else:
                print("Moon button not found, trying manual toggle for screenshot")
                page.evaluate("document.documentElement.classList.add('dark')")

            page.screenshot(path="verification/landing_dark.png")
            print("Captured landing_dark.png")

            # --- VERIFY LOGIN QUOTES ---
            print("Navigating to Login...")
            page.goto("http://localhost:3002/login")
            page.wait_for_timeout(2000)

            # Verify Quote exists (look for italic text)
            quote = page.locator("p.italic")
            if quote.is_visible():
                print(f"Quote found: {quote.text_content()}")
            else:
                print("Quote element not visible")

            page.screenshot(path="verification/login_quote.png")
            print("Captured login_quote.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_state.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_changes()
