import time
import re
from playwright.sync_api import sync_playwright

def verify_fixes():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 430, 'height': 932},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
        )
        page = context.new_page()

        # Debug Logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))
        page.on("requestfailed", lambda request: print(f"REQ FAILED: {request.url} - {request.failure}"))

        # Robust Mock User
        mock_user = {
            "_id": "test-user-id",
            "username": "testuser",
            "email": "test@example.com",
            "isVerified": True,
            "persona": "aastha",
            "stats": {
                "level": 1,
                "xp": 0,
                "streak": 1,
                "messagesSent": 0,
                "lastVisit": "2024-01-01T00:00:00.000Z"
            },
            "settings": {
                "theme": "light",
                "notifications": True,
                "soundEnabled": True,
                "voiceEnabled": False
            },
            "createdAt": "2024-01-01T00:00:00.000Z"
        }

        # Mock API responses - Use Broad Pattern
        page.route("**/*api/users/me", lambda route: route.fulfill(
            status=200, content_type="application/json", body=str(mock_user).replace("'", '"').replace("True", "true").replace("False", "false")
        ))

        page.route("**/*api/users/moods", lambda route: route.fulfill(
            status=200, content_type="application/json", body='[]'
        ))
        page.route("**/*api/users/diary", lambda route: route.fulfill(
            status=200, content_type="application/json", body='[]'
        ))
        page.route("**/*api/users/chat/history**", lambda route: route.fulfill(
             status=200, content_type="application/json", body='[]'
        ))

        try:
            target_url = "http://localhost:3000/sanctuary"
            print(f"Navigating to {target_url}...")
            page.goto(target_url)

            # Wait for App to Settle
            time.sleep(5)
            page.screenshot(path="verification/v3_step1_loaded.png")

            # Check for connecting text or spinner
            if page.get_by_text("Connecting to Aastha").is_visible():
                print("STILL CONNECTING - DUMPING LOGS")
                # Wait a bit longer just in case
                time.sleep(5)
                page.screenshot(path="verification/v3_step1_retry.png")
                if page.get_by_text("Connecting to Aastha").is_visible():
                    return

            print("App Loaded. Attempting to interact.")

            # Try to open Mood Tracker
            # Look for button by text 'Mood' or icon.
            # In mobile view, it's a carousel.

            mood_btn = page.get_by_text("Mood").first
            if mood_btn.is_visible():
                mood_btn.click()
                print("Clicked Mood button.")
            else:
                print("Mood button not found. Trying generic selector for carousel item.")
                # Try to click the second slide (Mood is usually 2nd or 3rd)
                # Or just search for the text in the DOM
                if page.locator("text=Mood").count() > 0:
                     page.locator("text=Mood").first.click()
                else:
                     page.locator(".swiper-slide").first.click()

            time.sleep(2)
            page.screenshot(path="verification/v3_step2_widget_open.png")

            # Check for Window
            if page.locator("text=Mood Tracker").is_visible():
                print("Mood Tracker Window Verified.")

                # Minimize
                print("Minimizing...")
                page.get_by_title("Minimize").click()
                time.sleep(1)
                page.screenshot(path="verification/v3_step3_minimized.png")

                # Check Bubble
                bubble = page.locator(".fixed.bottom-20.right-4")
                if bubble.is_visible():
                    print("SUCCESS: Floating Bubble Found!")

                    # Verify Color (Orange for Mood)
                    style = bubble.get_attribute("style")
                    if "#F97316" in style or "rgb(249, 115, 22)" in style:
                        print("SUCCESS: Bubble Color Verified (Orange).")
                    else:
                        print(f"WARNING: Bubble Color might be wrong: {style}")

                else:
                    print("FAILURE: Bubble not visible.")
            else:
                print("FAILURE: Mood Tracker Window did not open.")

        except Exception as e:
            print(f"CRITICAL ERROR: {e}")
            page.screenshot(path="verification/v3_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_fixes()
