from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})

    # 페이지 로드
    page.goto('http://localhost:3000/map')
    page.wait_for_load_state('networkidle')
    time.sleep(2)

    # 1. 다크모드 스크린샷 (기본)
    html_class = page.locator('html').get_attribute('class')
    print(f"초기 HTML 클래스: {html_class}")
    page.screenshot(path='/tmp/screenshot-dark.png', full_page=False)
    print("다크모드 스크린샷 저장: /tmp/screenshot-dark.png")

    # 테마 토글 버튼 클릭 (aria-label로 찾기)
    theme_toggle = page.locator('button[aria-label="라이트 모드로 전환"]')
    if theme_toggle.is_visible():
        print("테마 토글 버튼 클릭!")
        theme_toggle.click()
        time.sleep(1)

    # 2. 라이트모드 스크린샷
    html_class_after = page.locator('html').get_attribute('class')
    print(f"클릭 후 HTML 클래스: {html_class_after}")
    page.screenshot(path='/tmp/screenshot-light.png', full_page=False)
    print("라이트모드 스크린샷 저장: /tmp/screenshot-light.png")

    # 다시 다크모드로 전환
    theme_toggle2 = page.locator('button[aria-label="다크 모드로 전환"]')
    if theme_toggle2.is_visible():
        print("다시 다크모드로 전환!")
        theme_toggle2.click()
        time.sleep(1)

    html_class_final = page.locator('html').get_attribute('class')
    print(f"최종 HTML 클래스: {html_class_final}")
    page.screenshot(path='/tmp/screenshot-dark2.png', full_page=False)
    print("다크모드2 스크린샷 저장: /tmp/screenshot-dark2.png")

    browser.close()
    print("테스트 완료!")
