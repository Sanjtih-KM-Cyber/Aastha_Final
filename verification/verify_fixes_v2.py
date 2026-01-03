import time
from playwright.sync_api import sync_playwright

def verify_fixes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 430, 'height': 932},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
        )
        page = context.new_page()

        # Mock API responses
        page.route("**/api/users/me", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"_id":"test-user-id", "username":"testuser", "email":"test@example.com", "isVerified":true, "persona":"aastha", "settings": {}}'
        ))

        page.route("**/api/users/moods", lambda route: route.fulfill(
            status=200, content_type="application/json", body='[]'
        ))
        page.route("**/api/users/diary", lambda route: route.fulfill(
            status=200, content_type="application/json", body='[]'
        ))

        # Mock other potential endpoints to avoid errors
        page.route("**/api/users/chat/history**", lambda route: route.fulfill(
             status=200, content_type="application/json", body='[]'
        ))

        try:
            print("Navigating to Sanctuary...")
            page.goto("http://localhost:3001/sanctuary")

            # Wait for potential redirects or load
            page.wait_for_load_state('networkidle')
            time.sleep(3)

            print(f"Current URL: {page.url}")
            page.screenshot(path="verification/v2_step1_loaded.png")

            if "sanctuary" not in page.url:
                print("FAILED: Redirected away from Sanctuary. Likely Auth issue.")
                return

            # Check for ANY widget button in the carousel
            # The carousel items usually have a specific class or role
            # Let's try to click the first button element that contains text
            print("Looking for widget button...")

            # Assuming the carousel renders buttons.
            # We'll take a screenshot of the carousel area specifically if possible
            # Or just click "Diary" as it is usually first.

            try:
                # Try to find the Diary button. It might be an icon or text.
                # In the mobile carousel, it's likely a card.
                diary_btn = page.get_by_text("Diary").first
                if diary_btn.is_visible():
                    diary_btn.click()
                else:
                    # Fallback: Click the first generic button in the carousel wrapper?
                    # This is guessing. Let's rely on text "Diary".
                    print("Diary text not visible, checking for 'Mood'...")
                    page.get_by_text("Mood").first.click()
            except Exception as e:
                print(f"Could not click specific widget: {e}")
                print("Attempting to click center of screen (Carousel area)...")
                page.mouse.click(215, 800) # Bottom area where carousel usually is

            time.sleep(2)
            page.screenshot(path="verification/v2_step2_widget_attempt.png")

            # Check if a window opened.
            # DraggableWindow has a close button (X).
            close_btn = page.get_by_title("Close")
            if close_btn.is_visible():
                print("Widget Window Opened!")

                # Now Minimize
                min_btn = page.get_by_title("Minimize")
                min_btn.click()
                time.sleep(1)

                page.screenshot(path="verification/v2_step3_minimized.png")

                # Check for Bubble
                bubble = page.locator(".fixed.bottom-20.right-4")
                if bubble.is_visible():
                    print("SUCCESS: Floating Bubble is visible.")
                else:
                    print("FAILURE: Floating Bubble NOT visible.")
            else:
                print("Widget Window did NOT open.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/v2_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_fixes()
