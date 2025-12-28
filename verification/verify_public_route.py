from playwright.sync_api import sync_playwright

def verify_public_route_redirect():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a mobile viewport to test the responsiveness
        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()

        try:
            # Navigate to Landing Page (Port 3000 based on previous logs)
            page.goto("http://localhost:3000/")

            # Since we are not logged in, we should stay on Landing Page
            # Wait for content to appear (Hero section)
            page.wait_for_selector("text=Your AI Sanctuary", timeout=10000)

            # Screenshot Landing Page (Verify Visuals)
            page.screenshot(path="verification/landing_public_check.png")
            print("Landing page confirmed for public user.")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_public_route_redirect()
