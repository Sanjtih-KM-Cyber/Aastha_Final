from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a standard desktop viewport
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        print("Navigating to landing page...")
        page.goto("http://localhost:3001")

        # Wait for initial load
        page.wait_for_load_state("networkidle")

        # Simulate scrolling to trigger IntersectionObservers
        print("Scrolling to trigger animations...")
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(1) # Wait for scroll
        page.evaluate("window.scrollTo(0, 0)") # Scroll back up if needed, or just take full page

        # Actually, for IntersectionObserver to trigger 'visible', elements need to enter viewport.
        # Let's scroll down in steps.
        viewport_height = page.viewport_size['height']
        total_height = page.evaluate("document.body.scrollHeight")

        for i in range(0, total_height, viewport_height):
            page.evaluate(f"window.scrollTo(0, {i})")
            time.sleep(0.5) # Wait for animation start

        # Wait a bit for all animations (max delay is usually < 1s)
        print("Waiting for animations to settle...")
        time.sleep(2)

        print("Taking full page screenshot...")
        page.screenshot(path="verification/landing_page_full.png", full_page=True)

        print("Screenshot saved to verification/landing_page_full.png")
        browser.close()

if __name__ == "__main__":
    run()
