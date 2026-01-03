import time
from playwright.sync_api import sync_playwright

def verify_fixes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Emulate iPhone 14 Pro Max
        context = browser.new_context(
            viewport={'width': 430, 'height': 932},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
        )
        page = context.new_page()

        # Mock API responses
        page.route("**/api/users/me", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"_id":"test-user-id", "username":"testuser", "email":"test@example.com", "isVerified":true, "persona":"aastha"}'
        ))

        # Mock Moods & Diary to prevent errors
        page.route("**/api/users/moods", lambda route: route.fulfill(
            status=200, content_type="application/json", body='[]'
        ))
        page.route("**/api/users/diary", lambda route: route.fulfill(
            status=200, content_type="application/json", body='[]'
        ))

        try:
            # 1. Navigate to Sanctuary
            print("Navigating to Sanctuary...")
            page.goto("http://localhost:3001/sanctuary")
            page.wait_for_load_state('networkidle')
            time.sleep(2) # Allow React to hydrate

            # 2. Check for Widget Layer
            print("Checking Widget Layer...")
            # We look for the Mood Tracker launch button (or any widget launch button)
            # Assuming the 'Widget Universe' carousel is visible.
            # We'll take a screenshot of the initial state.
            page.screenshot(path="verification/1_initial_load.png")

            # 3. Open Mood Tracker to verify it opens
            print("Opening Mood Tracker...")
            # Clicking center of screen where widget usually is or finding a specific button
            # In mobile carousel, MoodTracker might be the first or second one.
            # Let's try to find text "Mood"
            page.get_by_text("Mood").first.click()
            time.sleep(1)
            page.screenshot(path="verification/2_mood_opened.png")

            # 4. Minimize Mood Tracker to verify Bubble
            print("Minimizing Mood Tracker...")
            # Find the yellow minimize button. On mobile, it's in the header.
            # The header is absolute positioned.
            # We can use the 'Minimize' title on the button
            page.get_by_title("Minimize").click()
            time.sleep(1)

            # Verify Bubble appears
            # Bubble class has 'bottom-20 right-4'
            bubble = page.locator(".fixed.bottom-20.right-4")
            if bubble.is_visible():
                print("SUCCESS: Floating Bubble is visible.")
            else:
                print("FAILURE: Floating Bubble NOT visible.")

            page.screenshot(path="verification/3_bubble_visible.png")

            # 5. Open Diary to verify Styling
            # First, restore Mood Tracker and close it to clean up? Or just open Diary.
            # Click Bubble to restore
            bubble.click()
            time.sleep(0.5)
            # Close Mood Tracker
            page.get_by_title("Close").click()
            time.sleep(0.5)

            # Open Diary
            print("Opening Diary...")
            page.get_by_text("Diary").first.click()
            time.sleep(1)

            # Screenshot Diary Styling
            page.screenshot(path="verification/4_diary_styling.png")

            print("Verification Complete.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_state.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_fixes()
