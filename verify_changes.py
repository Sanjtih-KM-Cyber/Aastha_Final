import json
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)

    # --- TEST 1: DESKTOP ---
    print("--- Starting Desktop Test ---")
    page = browser.new_page(viewport={'width': 1280, 'height': 720})

    # Mock APIs
    page.route("**/api/users/login", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps({
            "token": "fake-jwt-token",
            "user": {
                "id": "123",
                "name": "Test User",
                "email": "test@example.com",
                "hasDiarySetup": False
            }
        })
    ))

    page.route("**/api/users/me", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps({
            "id": "123",
            "name": "Test User",
            "email": "test@example.com",
            "hasDiarySetup": False,
            "streak": 5,
            "isPro": True
        })
    ))

    page.route("**/api/users/diary", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps([])
    ))

    # Login
    print("Navigating to login...")
    page.goto("http://localhost:3002/")
    page.fill('input[placeholder="Email or Username"]', "test@example.com")
    page.fill('input[placeholder="Password"]', "password")
    page.click('text="Enter Sanctuary"')

    print("Waiting for Sanctuary...")
    # Wait for Sidebar text "Sanctuary" (Desktop)
    try:
        page.wait_for_selector('text="Sanctuary"', timeout=10000)
        print("Logged in successfully.")
    except Exception as e:
        print("Timeout waiting for 'Sanctuary' text.")
        page.screenshot(path="error_desktop_login.png")
        raise e

    # Open Diary (Journal)
    print("Opening Journal...")
    # Click the "Journal" button in the sidebar
    page.click('button:has-text("Journal")')

    # Wait for Window
    page.wait_for_selector('text="Personal Journal"')
    print("Journal Window Opened.")

    # Verify macOS Buttons
    print("Verifying macOS Buttons...")
    # Look for Red Button (bg-[#FF5F57])
    red_btn = page.locator('button.bg-\[\#FF5F57\]')
    if red_btn.count() > 0:
        print("PASS: Red Close Button found.")
    else:
        print("FAIL: Red Close Button NOT found.")
        page.screenshot(path="error_desktop_buttons.png")
        exit(1)

    # Look for Yellow Button (bg-[#FEBC2E])
    yellow_btn = page.locator('button.bg-\[\#FEBC2E\]')
    if yellow_btn.count() > 0:
        print("PASS: Yellow Minimize Button found.")
    else:
        print("FAIL: Yellow Minimize Button NOT found.")
        exit(1)

    # Verify NO Green Button (Standard Mac Green is usually #28C840 or similar, but we just check if there's a third one in that group)
    # The group has `flex items-center gap-2`.
    buttons = page.locator('.flex.items-center.gap-2.group > button')
    count = buttons.count()
    if count == 2:
        print(f"PASS: Correct number of buttons found ({count}).")
    else:
        print(f"FAIL: Found {count} buttons, expected 2.")
        exit(1)

    page.close()

    # --- TEST 2: MOBILE ---
    print("\n--- Starting Mobile Test ---")
    # iPhone 14 Pro Max viewport
    page_mobile = browser.new_page(viewport={'width': 430, 'height': 932})

    # Apply same mocks
    page_mobile.route("**/api/users/login", lambda route: route.fulfill(
        status=200, content_type="application/json", body=json.dumps({"token":"fake","user":{"id":"123","hasDiarySetup":False}})
    ))
    page_mobile.route("**/api/users/me", lambda route: route.fulfill(
        status=200, content_type="application/json", body=json.dumps({"id":"123","hasDiarySetup":False,"name":"Mobile User"})
    ))
    page_mobile.route("**/api/users/diary", lambda route: route.fulfill(status=200, body=json.dumps([])))

    print("Navigating to login (Mobile)...")
    page_mobile.goto("http://localhost:3002/")
    page_mobile.fill('input[placeholder="Email or Username"]', "test@example.com")
    page_mobile.fill('input[placeholder="Password"]', "password")
    page_mobile.click('text="Enter Sanctuary"')

    # Wait for Mobile View (Widget Universe)
    # The header "Your Sanctuary" is visible on mobile in WellnessHub
    try:
        page_mobile.wait_for_selector('text="Your Sanctuary"', timeout=10000)
        print("Logged in (Mobile).")
    except:
        print("Timeout waiting for Mobile Dashboard.")
        page_mobile.screenshot(path="error_mobile_login.png")
        # On mobile, the sidebar is hidden. We look for the top header or carousel.
        # WellnessHub mobile has <h2 ...>Your Sanctuary</h2>
        raise

    # Verify Scroll Snap (Static Check)
    print("Verifying Scroll Snap CSS...")
    carousel = page_mobile.locator('.snap-x.snap-mandatory')
    if carousel.count() > 0:
        print("PASS: Carousel has snap classes.")
        # Check inline style for scrollSnapStop
        style = carousel.get_attribute("style")
        if "scroll-snap-stop: always" in style.lower() or "scrollsnapstop: 'always'" in style:
             # Note: get_attribute returns the string as in DOM. React style might not be exactly 'scroll-snap-stop: always' in attribute unless styled-components or inline.
             # React `style={{ scrollSnapStop: 'always' }}` usually renders as `style="scroll-snap-stop: always;"`.
             print("PASS: scroll-snap-stop style detected.")
        else:
             print(f"WARNING: scroll-snap-stop style might be missing or different format: {style}")
    else:
        print("FAIL: Carousel snap classes missing.")

    # Open Journal
    print("Opening Journal (Mobile)...")
    # Find "Tap to Open" inside the Journal card (First item)
    # We can just search for the text since it's unique enough or click the first one.
    page_mobile.click('text="Tap to Open"')

    # Wait for Diary
    page_mobile.wait_for_selector('text="Personal Journal"')

    # Verify Mobile Header Icons
    print("Verifying Mobile Header...")
    # Check for Calendar Icon (Lucide 'Calendar')
    # It is in a button. We can look for the button with the calendar icon or the button next to the date.
    # The code: <button onClick={() => setIsCalendarModalOpen(true)} ...><Calendar .../></button>
    # We can try to select by the Calendar svg class or the button structure.
    # Simplified: Look for a button that opens the modal.
    # The date is displayed, e.g., "Monday, October 23, 2023".

    # Verify Calendar Button exists
    # We can assume it's the button with the Calendar icon.
    calendar_btns = page_mobile.locator('button svg.lucide-calendar')
    if calendar_btns.count() > 0:
        print("PASS: Calendar Icon Button found.")
    else:
        print("FAIL: Calendar Icon Button NOT found.")
        page_mobile.screenshot(path="error_mobile_header.png")
        exit(1)

    # Click Calendar Button
    print("Opening Calendar Modal...")
    calendar_btns.first.click()

    # Verify Modal
    print("Verifying Calendar Modal...")
    try:
        page_mobile.wait_for_selector('text="Select Date"', timeout=2000)
        print("PASS: Calendar Modal Opened.")
    except:
        print("FAIL: Calendar Modal did not open.")
        page_mobile.screenshot(path="error_mobile_modal.png")
        exit(1)

    # Verify Modal Content (Grid)
    if page_mobile.locator('text="Su"').count() > 0:
        print("PASS: Calendar Grid Header found.")

    # Click a day (e.g., '15')
    print("Selecting a date...")
    page_mobile.click('button:has-text("15")')

    # Verify Modal Closes
    # 'Select Date' should disappear
    try:
        page_mobile.wait_for_selector('text="Select Date"', state='hidden', timeout=2000)
        print("PASS: Calendar Modal Closed after selection.")
    except:
        print("FAIL: Modal did not close.")
        page_mobile.screenshot(path="error_mobile_modal_close.png")
        exit(1)

    print("\n--- ALL TESTS PASSED ---")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
