from selenium import webdriver
import time

# Create a new Safari driver instance
driver = webdriver.Safari()

# Open Google
driver.get('https://www.google.com')

# Sleep for 5 seconds
time.sleep(5)

# Close the browser
driver.quit()