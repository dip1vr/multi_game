import os
import time
import re
import json
import logging
import requests
import base64
from pathlib import Path

# --- SELENIUM IMPORTS ---
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from webdriver_manager.chrome import ChromeDriverManager

# --- CONFIGURATION ---
INPUT_FILE = 'character_names.txt'
IMAGES_DIR = 'image'
CHAR_JSON = 'characters.json'
DELAY_SECONDS = 1.0  # Reduced delay since Bing is lenient

# --- LOGGING ---
logging.basicConfig(
    format='%(asctime)s - %(levelname)s - %(message)s',
    level=logging.INFO,
    handlers=[logging.FileHandler("downloader_fast.log"), logging.StreamHandler()]
)

def sanitize_for_filename(s: str) -> str:
    s = s or ""
    s = s.strip().replace(' ', '_')
    return re.sub(r'[^A-Za-z0-9_\-]', '', s)

def load_char_series_map(path: Path) -> dict:
    try:
        with path.open(encoding='utf-8') as f:
            data = json.load(f)
        m = {}
        for item in data:
            if isinstance(item, dict):
                name = item.get('name')
                series = item.get('series')
                if name:
                    m[name.lower()] = series or ''
        return m
    except:
        return {}

def setup_driver():
    options = Options()
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1280,800")
    options.add_argument("--no-sandbox")
    options.add_argument("--log-level=3")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    
    try:
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        return driver
    except Exception as e:
        print(f"Driver Error: {e}")
        return None

def download_file(url, save_path):
    try:
        if not url: return False
        
        if url.startswith("data:image"):
            header, encoded = url.split(",", 1)
            data = base64.b64decode(encoded)
            with open(save_path, "wb") as f:
                f.write(data)
            return True
            
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            with open(save_path, 'wb') as f:
                f.write(response.content)
            return True
    except:
        pass
    return False

# --- OPTIMIZED BING SEARCH ---
def search_bing(driver, query):
    """
    Searches Bing Images directly.
    """
    try:
        # qft=+filterui:imagesize-large (Optional: forces large images)
        url = f"https://www.bing.com/images/search?q={query}"
        driver.get(url)
        wait = WebDriverWait(driver, 3)
        
        # 'img.mimg' is the standard class for Bing results
        # We try to get the first one that looks real
        thumbs = wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, "img.mimg")))
        
        for img in thumbs:
            if not img.is_displayed(): continue
            
            # Bing often puts the high-res link in 'src' or 'data-src'
            src = img.get_attribute('src')
            if src and src.startswith('http'):
                return src
                
        return None
    except:
        return None

def search_google_backup(driver, query):
    """Only used if Bing fails completely."""
    try:
        url = f"https://www.google.com/search?q={query}&tbm=isch"
        driver.get(url)
        wait = WebDriverWait(driver, 3)
        thumb = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "img.rg_i")))
        return thumb.get_attribute('src')
    except:
        return None

# --- MAIN LOOP ---

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"ERROR: {INPUT_FILE} not found.")
        return

    images_path = Path(IMAGES_DIR)
    images_path.mkdir(parents=True, exist_ok=True)
    char_map = load_char_series_map(Path(CHAR_JSON))

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        lines = [line.strip() for line in f if line.strip()]

    print(f"--- STARTING FAST DOWNLOADER (Bing First) ---")
    
    driver = setup_driver()
    if not driver: return

    for i, raw in enumerate(lines, 1):
        print(f"[{i}/{len(lines)}] Processing: {raw}")

        # --- Name Logic ---
        name_only = raw
        series = ''
        if '|' in raw:
            parts = raw.split('|', 1)
            name_only, series = parts[0].strip(), parts[1].strip()
        else:
            match = ''
            for k in char_map.keys():
                if raw.lower().startswith(k) and len(k) > len(match):
                    match = k
            if match:
                name_only = match
                series = char_map.get(match, '')

        search_query = f"{name_only} {series}".strip()
        if not series and "anime" not in search_query.lower():
            search_query += " anime"

        name_part = sanitize_for_filename(name_only).lower()
        series_part = sanitize_for_filename(series).title()
        filename = f"{name_part}_{series_part}.jpg" if series_part else f"{name_part}.jpg"
        dest_path = images_path / filename

        if dest_path.exists():
            print("   -> File exists. Skipping.")
            continue

        # --- FAST SEARCH (Bing First) ---
        image_url = search_bing(driver, search_query)
        source = "Bing"
        
        # Backup: Google (Only if Bing fails)
        if not image_url:
            print("   -> Bing returned nothing. Checking Google...")
            image_url = search_google_backup(driver, search_query)
            source = "Google"

        if image_url:
            if download_file(image_url, dest_path):
                print(f"   -> Success ({source}): {dest_path}")
            else:
                print(f"   -> Download error.")
        else:
            print("   -> Not found.")

        time.sleep(DELAY_SECONDS)

    if driver:
        driver.quit()
    print("--- DONE ---")

if __name__ == "__main__":
    main()