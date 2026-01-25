from playwright.sync_api import sync_playwright
import time
import json

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # 1. Bypass Auth
        dummy_user = {
            "_id": "dummy_user_id", "name": "Test User", "email": "test@example.com",
            "token": "dummy_token", "isOnboardingComplete": True, "masterKey": "dummy_key"
        }
        page.add_init_script(f"localStorage.setItem('userInfo', JSON.stringify({json.dumps(dummy_user)}));")
        page.route("**/api/users/me", lambda r: r.fulfill(json=dummy_user))

        # 2. Mock Moods (Offline Scenario)
        def handle_post(route):
            print("MOCK: Blocking POST /api/data/moods")
            route.abort("connectionrefused")

        page.route("**/api/data/moods", lambda r: r.fulfill(json=[]) if r.request.method == "GET" else handle_post(r))

        print("Navigating...")
        page.goto("http://localhost:3000/sanctuary")

        print("Opening Mood Tracker...")
        page.locator("#nav-mood").click()
        page.wait_for_selector("text=Excited")

        print("Clicking 'Excited' (Standard Click)...")
        # This standard click verifies the Z-index fix
        page.locator("button").filter(has_text="Excited").first.click()

        print("Waiting for success message...")
        page.wait_for_selector("text=Logged Successfully", timeout=5000)

        # Take Screenshot
        page.screenshot(path="verification/mood_fix_verified.png")
        print("Success! Screenshot saved to verification/mood_fix_verified.png")

        browser.close()

if __name__ == "__main__":
    run()
