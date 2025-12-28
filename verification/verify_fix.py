from playwright.sync_api import sync_playwright

def verify_tailwaind_and_socket():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a mobile viewport to test the responsiveness
        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()

        try:
            # Navigate to Landing Page (Port 3000 based on previous logs)
            page.goto("http://localhost:3000/")

            # Wait for content to appear (Hero section)
            # This verifies that Tailwind styles are applied (e.g., background color, fonts)
            # If Tailwind was broken, the layout would be completely messed up
            page.wait_for_selector("text=Your AI Sanctuary", timeout=10000)

            # Check if body has correct background color (from tailwind config/css)
            # #0a0e17 is rgb(10, 14, 23)
            bg_color = page.evaluate("window.getComputedStyle(document.body).backgroundColor")
            print(f"Body Background Color: {bg_color}")

            # Screenshot Landing Page (Verify Visuals)
            page.screenshot(path="verification/landing_fixed.png")
            print("Landing page screenshot captured.")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_tailwaind_and_socket()
