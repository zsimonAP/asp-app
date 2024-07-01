from selenium import webdriver
import time
import sys

# Create a new Safari driver instance
driver = webdriver.Safari()

driver.get('https://www.google.com')
time.sleep(5)

url = sys.argv[1]
# Open the provided URL
driver.get(url)

# Sleep for 5 seconds
time.sleep(5)

# Close the browser
driver.quit()