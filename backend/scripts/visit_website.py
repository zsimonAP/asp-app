# visit_website.py

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
import time
import sys

def open_website(url):
    driver = webdriver.Safari()
    driver.get(url)
    return driver

if __name__ == "__main__":
    google_url = "https://www.google.com"
    driver = open_website(google_url)
    time.sleep(5)
    print("Google opened successfully.")
    print("WAIT_FOR_INPUT", flush=True)
    
    new_url = input("Enter the new URL: ").strip()
    if new_url:
        driver.get(new_url)
        print(f"Opened new URL: {new_url}", flush=True)
    else:
        print("No URL entered. Exiting...", flush=True)
    
    time.sleep(10)  # Keep the browser open for a while to see the result
    driver.quit()
    print("SCRIPT_COMPLETED", flush=True)