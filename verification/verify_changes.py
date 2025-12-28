from playwright.sync_api import sync_playwright

def verify_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a mobile viewport to test the responsiveness
        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()

        try:
            # Navigate to Landing Page (Port 3000 based on logs)
            page.goto("http://localhost:3000/")
            # Wait for content to appear (Hero section)
            page.wait_for_selector("text=Your AI Sanctuary", timeout=10000)

            # Screenshot Landing Page (Mobile)
            page.screenshot(path="verification/landing_mobile.png")
            print("Landing page screenshot captured.")

            # Navigate to Login
            page.goto("http://localhost:3000/login")
            page.wait_for_selector("input[type='text']", timeout=10000)

            # Screenshot Login Page
            page.screenshot(path="verification/login_mobile.png")
            print("Login page screenshot captured.")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_frontend()
