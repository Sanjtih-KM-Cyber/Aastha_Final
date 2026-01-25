from playwright.sync_api import sync_playwright
import time
import json

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Capture logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        # 1. Bypass Auth
        dummy_user = {
            "_id": "dummy_user_id", "name": "Test User", "email": "test@example.com",
            "token": "dummy_token", "isOnboardingComplete": True, "masterKey": "dummy_key"
        }
        page.add_init_script(f"localStorage.setItem('userInfo', JSON.stringify({json.dumps(dummy_user)}));")
        page.route("**/api/users/me", lambda r: r.fulfill(json=dummy_user))

        # 2. Block Native Biometric Calls (Implicitly tested by the fact that we are in browser)
        # But we want to ensure no errors are thrown.

        print("Navigating...")
        page.goto("http://localhost:3000/sanctuary")

        print("Waiting for stability...")
        time.sleep(5) # Watch logs for reconnect loops or errors

        print("Done watching.")
        browser.close()

if __name__ == "__main__":
    run()
