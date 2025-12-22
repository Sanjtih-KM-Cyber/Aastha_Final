import time
from playwright.sync_api import sync_playwright

def verify_mobile_flow():
    with sync_playwright() as p:
        # 1. Launch Mobile Browser (iPhone 14 Pro Max)
        iphone = p.devices['iPhone 14 Pro Max']
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(**iphone)
        page = context.new_page()

        print("Navigating to app...")
        try:
            page.goto("http://localhost:3000")
            page.wait_for_load_state("networkidle")

            # 2. Handle Login
            print("Checking for login screen...")
            try:
                # Wait for email input
                page.wait_for_selector("input[placeholder='Email or Username']", timeout=5000)
                print("Login screen detected. Logging in...")

                # Fill fields explicitly
                page.fill("input[placeholder='Email or Username']", "testuser")
                page.fill("input[placeholder='Password']", "password123")

                # Click the submit button
                page.click("button:has-text('Enter Sanctuary')")

                print("Clicked login. Waiting for navigation...")
                page.wait_for_load_state("networkidle")

            except Exception as e:
                print(f"Login check skipped (might already be logged in or timed out): {e}")

            # 3. Verify Dashboard
            print("Verifying Dashboard...")
            try:
                # Wait for "Diary" text in the carousel
                page.wait_for_selector("text=Diary", timeout=15000)
                print("Dashboard loaded successfully.")
            except Exception as e:
                print("Failed to load Dashboard. Taking screenshot...")
                page.screenshot(path="mobile_dashboard_fail.png")
                raise e

            # 4. Open Diary Widget
            print("Opening Diary Widget...")
            page.click("text=Diary")
            page.wait_for_timeout(2000) # Animation wait

            # 5. Verify Mobile Layout
            print("Verifying Diary Layout...")
            page.screenshot(path="mobile_diary_opened.png")

            # Check for Mobile Header presence
            if page.locator("text=Personal Journal").count() > 0:
                 # Note: The "Personal Journal" title is in DraggableWindow header, which is visible.
                 # The mobile specific header inside Diary has the date.
                 print("Draggable Window Header found.")

            # 6. Open Calendar Modal
            print("Testing Calendar Modal...")
            # Click the Calendar button. It's the button next to the date.
            # We target it by the Lucide class or position.
            # In the code: <button ...><Calendar .../></button>
            # We can try to click the button that has a child SVG with 'lucide-calendar' class?
            # Or just use the 2nd button in the visible area if we narrow scope?

            # Let's try locating by the icon class if rendered by Lucide
            # Lucide icons usually render as <svg class="lucide lucide-calendar" ...>
            # So: button:has(svg.lucide-calendar)

            calendar_btn = page.locator("button:has(svg.lucide-calendar)")
            if calendar_btn.count() > 0:
                calendar_btn.first.click()
                print("Clicked Calendar Button.")

                # Wait for Modal Content
                page.wait_for_selector("text=Select Date", timeout=2000)
                print("Calendar Modal Opened (Found 'Select Date').")

                page.screenshot(path="mobile_calendar_modal.png")

                # Close Modal (X button inside modal)
                page.click("text=Select Date >> .. >> button") # The button sibling to the title
                print("Closed Calendar Modal.")
            else:
                print("WARNING: Calendar button not found via selector 'button:has(svg.lucide-calendar)'.")

            # 7. Close Widget (Traffic Light)
            print("Closing Diary via macOS Button...")
            # Look for button with title="Close"
            close_btn = page.locator("button[title='Close']")

            if close_btn.count() > 0:
                # Check color (optional, but good for verification)
                # We can't easily check computed style in one line, but existence is key.
                close_btn.click()
                print("Clicked macOS Close Button.")
                page.wait_for_timeout(1000)

                # Verify it's closed (Dashboard visible again)
                if page.locator("text=Diary").is_visible():
                     print("SUCCESS: Diary closed, returned to Dashboard.")
                else:
                     print("WARNING: Diary might not have closed?")
            else:
                print("FAILURE: macOS Close button (title='Close') not found.")
                # Debug: print all button titles
                titles = page.locator("button").all_get_attributes("title")
                print(f"Available button titles: {titles}")

        except Exception as e:
            print(f"Test Failed: {e}")
            page.screenshot(path="mobile_fail_final.png")

        finally:
            browser.close()

if __name__ == "__main__":
    verify_mobile_flow()
