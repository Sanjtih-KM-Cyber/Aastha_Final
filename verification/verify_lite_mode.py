from playwright.sync_api import sync_playwright

def verify_lite_mode():
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)

        # Create a context with mobile viewport to trigger default Lite Mode
        context = browser.new_context(
            viewport={'width': 375, 'height': 667},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
        )
        page = context.new_page()

        print("Navigating to Landing Page...")
        page.goto("http://localhost:3000/")

        # Wait for content to load
        page.wait_for_timeout(2000)

        # Take screenshot of Landing Page in Lite Mode
        print("Taking Landing Page Screenshot...")
        page.screenshot(path="verification/landing_lite_mode.png")

        # Click "Start Your Journey" to go to Login
        print("Navigating to Login Page...")
        # Finding the button by text content
        page.click("text=Start Your Journey")

        # Wait for navigation
        page.wait_for_timeout(2000)

        # Take screenshot of Login Page in Lite Mode
        print("Taking Login Page Screenshot...")
        page.screenshot(path="verification/login_lite_mode.png")

        browser.close()

if __name__ == "__main__":
    verify_lite_mode()
