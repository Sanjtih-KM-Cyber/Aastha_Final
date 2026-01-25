from playwright.sync_api import Page, expect, sync_playwright
import time

def test_diary_ui(page: Page):
    print("Navigating to Sanctuary...")
    page.goto("http://localhost:3000/sanctuary")

    print("Waiting for page load...")
    # Wait for the "Diary" button
    diary_btn = page.get_by_role("button", name="Diary")
    diary_btn.wait_for(state="visible", timeout=30000)

    print("Opening Diary...")
    diary_btn.click()

    # Wait for window
    print("Waiting for Diary window...")
    diary_title = page.get_by_text("Personal Diary")
    diary_title.wait_for(state="visible", timeout=10000)

    # Wait for animation to settle
    page.wait_for_timeout(2000)

    print("Taking screenshot of expanded diary...")
    page.screenshot(path="verification/diary_expanded.png")

    # Minimize
    print("Minimizing...")
    minimize_btn = page.locator('button[title="Minimize"]')
    if not minimize_btn.is_visible():
        # Maybe title="Expand" if it thinks it is minimized?
        minimize_btn = page.locator('button[title="Expand"]')

    minimize_btn.click()

    # Wait for animation
    page.wait_for_timeout(2000)

    print("Taking screenshot of minimized diary...")
    page.screenshot(path="verification/diary_minimized.png")

    # Check width using evaluate
    # Find the DraggableWindow container. It contains "Personal Diary".
    # The container is the one with the style width.
    # The title is in a div inside header inside container.
    # Structure: motion.div > div > div(header) > ... > span(Title)
    # We can select by text, then go up parents.

    # Or just select the motion.div directly if we can identify it.
    # DraggableWindow has className containing "fixed flex flex-col".
    # And it contains "Personal Diary".

    width = page.evaluate('''() => {
        const titleSpan = Array.from(document.querySelectorAll('span')).find(s => s.textContent === 'Personal Diary');
        if (!titleSpan) return 0;
        // Go up to the fixed container.
        // span -> div -> div(header) -> div(inner container) -> motion.div(fixed container)
        const container = titleSpan.closest('.fixed');
        return container ? container.getBoundingClientRect().width : 0;
    }''')

    print(f"Minimized Width: {width}px")

    if width > 240 and width < 260:
        print("SUCCESS: Width is around 250px.")
    else:
        print(f"FAILURE: Width is {width}px, expected 250px.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        try:
            test_diary_ui(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
