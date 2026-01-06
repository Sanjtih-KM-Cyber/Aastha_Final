import os
from playwright.sync_api import sync_playwright

def verify_onboarding_mobile(page):
    # Mock viewport for mobile
    page.set_viewport_size({"width": 375, "height": 667})

    # Go to landing page
    # Note: We need the client to be running. Assuming port 5173 (Vite default)
    try:
        page.goto("http://localhost:5173", timeout=30000)
    except Exception as e:
        print(f"Error navigating: {e}")
        return

    # Wait for page load
    page.wait_for_timeout(2000)

    # Trigger Onboarding Tour (Mocking: We might need to clear localStorage or force it)
    # The OnboardingTour component is usually triggered if 'isOnboardingComplete' is false.
    # We can try to force it by injecting a mock User into AuthContext if possible,
    # but since it's the landing page tour, it might just run?
    # Actually, the user's issue was "arrows in onboarding in mobile".
    # This implies the OnboardingTour is visible.

    # Let's try to simulate a state where the tour is open.
    # The OnboardingTour component requires props.
    # It's used in 'Sanctuary.tsx' and maybe 'Landing.tsx'?

    # I will verify by looking at the Landing Page first.
    # If the tour is not there, I might need to login.

    # Take a screenshot
    page.screenshot(path="verification/mobile_arrow_check.png")
    print("Screenshot taken.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_onboarding_mobile(page)
        finally:
            browser.close()
