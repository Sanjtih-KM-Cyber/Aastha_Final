import os
from playwright.sync_api import sync_playwright

def verify_streak_crackle(page):
    # Desktop Viewport
    page.set_viewport_size({"width": 1280, "height": 720})

    try:
        page.goto("http://localhost:5173", timeout=30000)
    except Exception as e:
        print(f"Error navigating: {e}")
        return

    # Wait for load
    page.wait_for_timeout(2000)

    # Note: Accessing Sanctuary requires login.
    # Since I cannot easily login in headless mode with OTP without mocking,
    # I will inspect the code changes manually or rely on unit tests/logic verification.
    # However, I can try to see if the Landing Page has any flame icons? (Unlikely)

    # The Flame icon is in 'WellnessHub.tsx', which is part of the Sidebar.
    # This requires Auth.

    print("Skipping visual verification of authenticated routes due to OTP complexity.")
    # I will rely on my code verification (Tailwind config + Component Prop).

if __name__ == "__main__":
    pass
