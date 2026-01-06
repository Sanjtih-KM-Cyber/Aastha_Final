
from playwright.sync_api import Page, expect, sync_playwright

def verify_faq_content(page: Page):
    page.goto("http://localhost:4173/")

    # Scroll to FAQ
    # We can just look for the text directly

    # Check for new questions
    expect(page.get_by_text("How does voice mode work?")).to_be_visible()
    expect(page.get_by_text("What makes Aastha different?")).to_be_visible()

    # Check for removed question
    # "Can I use it offline?" should be gone
    if page.get_by_text("Can I use it offline?").count() > 0:
        print("WARNING: 'Can I use it offline?' is still present.")
    else:
        print("SUCCESS: Old offline question removed.")

    # Expand one to see answer
    page.get_by_text("How does voice mode work?").click()
    page.wait_for_timeout(500)

    expect(page.get_by_text("Simply tap the microphone icon")).to_be_visible()

    page.screenshot(path="/home/jules/verification/faq_updated.png")

if __name__ == "__main__":
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
      verify_faq_content(page)
    finally:
      browser.close()
