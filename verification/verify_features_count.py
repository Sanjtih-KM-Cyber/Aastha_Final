from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        print("Navigating to landing page...")
        page.goto("http://localhost:3001")
        page.wait_for_load_state("networkidle")

        # Scroll down to features section to trigger FadeIn
        # The section has id="features-section"
        print("Scrolling to features section...")
        page.locator("#features-section").scroll_into_view_if_needed()

        # Incremental scroll to ensure all intersection observers trigger
        # We scroll a bit more than just "into view" because we want the bottom elements to trigger too
        for i in range(5):
            page.mouse.wheel(0, 300)
            time.sleep(0.5)

        # Allow animations to complete
        time.sleep(2)

        # Select all feature titles (h3 tags inside the features section)
        # We know the titles:
        expected_titles = [
            "End-to-End Encrypted",
            "Voice Conversations",
            "Mood Analytics",
            "Mindful Focus Tools",
            "Always Available",
            "Personalized Insights"
        ]

        found_count = 0
        missing = []

        for title in expected_titles:
            # Check if text is visible
            locator = page.get_by_text(title, exact=True)
            if locator.count() > 0 and locator.first.is_visible():
                found_count += 1
                print(f"✅ Found: {title}")
            else:
                missing.append(title)
                print(f"❌ Missing or invisible: {title}")

        print(f"\nTotal visible features found: {found_count}/6")

        if found_count == 6:
            print("SUCCESS: All 6 features are visible.")
        else:
            print("FAILURE: Some features are missing.")

        browser.close()

if __name__ == "__main__":
    run()
