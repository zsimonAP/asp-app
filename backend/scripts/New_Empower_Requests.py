import os
import time
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support.ui import Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException, NoSuchElementException, NoSuchWindowException
from datetime import datetime


print("WAIT_FOR_INPUT:Enter your username", flush=True)
username = input()
print("WAIT_FOR_INPUT:Enter your password", flush=True)
password = input()
today_date = datetime.today().strftime('%m/%d/%Y')
output_path = f'W:\\Zach\\Empower-Requests\\Empower Request Spreadsheet {today_date.replace("/", "-")} Morning.xlsx'
yesterday_file_path = 'W:\\Zach\\Empower-Requests'

def get_auth_code():
    while True:
        print("WAIT_FOR_INPUT:Please enter your 8-digit authentication code: ", flush=True)
        auth_code = input()
        if len(auth_code) == 8 and auth_code.isdigit():
            return auth_code
        else:
            print("Invalid input. Please ensure you enter exactly 8 digits.")

def submit_code_and_verify():
    code_input_xpath = '//*[@id="mfaCode"]'
    error_message_xpath = '//*[@id="secured-component"]/div/div/div[2]/div/div[2]/div[2]/div[1]/div[1]/div/span'
    verify_button_xpath = '//button[@id="MFACodeVerification-Button" and contains(@class, "signIn-Button")]'
    remember_device_checkbox_xpath = '//input[@id="mfaRememberDevice"]'
    tasks_button_xpath = '//*[@id="pl-actionCenter"]/a/span[2]'

    while True:
        auth_code = get_auth_code()
        
        code_input_field = WebDriverWait(driver, 10).until(EC.visibility_of_element_located((By.XPATH, code_input_xpath)))
        code_input_field.clear()
        code_input_field.send_keys(auth_code)
        time.sleep(2)

        remember_device_checkbox = WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.XPATH, remember_device_checkbox_xpath)))
        if not remember_device_checkbox.is_selected():
            driver.execute_script("arguments[0].click();", remember_device_checkbox)

        sign_in_button = wait.until(EC.element_to_be_clickable((By.XPATH, verify_button_xpath)))
        sign_in_button.click()

        try:
            WebDriverWait(driver, 5).until(EC.visibility_of_element_located((By.XPATH, tasks_button_xpath)))
            print("Tasks button found. Authentication successful.")
            break
        except TimeoutException:
            try:
                WebDriverWait(driver, 3).until(EC.visibility_of_element_located((By.XPATH, error_message_xpath)))
                print("We found some errors. Please review below and make corrections.")
            except TimeoutException:
                print("Code verified successfully.")
                break

driver = webdriver.Edge()
driver.get('https://plan.empower-retirement.com/planweb/#/login/?accu=PlanEmpowerCR')

username_xpath = '//*[@id="main-panel"]/div/div/div[2]/div/div[1]/div/div[2]/div[1]/form/div[1]/div[1]/span[1]/input'
password_xpath = '//*[@id="main-panel"]/div/div/div[2]/div/div[1]/div/div[2]/div[1]/form/div[1]/div[2]/span[1]/input'
sign_in_xpath = '//*[@id="main-panel"]/div/div/div[2]/div/div[1]/div/div[2]/div[1]/form/button'

wait = WebDriverWait(driver, 20)
username_field = wait.until(EC.visibility_of_element_located((By.XPATH, username_xpath)))
username_field.send_keys(username)
password_field = wait.until(EC.visibility_of_element_located((By.XPATH, password_xpath)))
password_field.send_keys(password)
sign_in_button = wait.until(EC.element_to_be_clickable((By.XPATH, sign_in_xpath)))
sign_in_button.click()
time.sleep(3)

dropdown_xpath = '//*[@id="mfaDeliveryMethod"]'
send_code_button_xpath = '//button[@type="submit" and contains(@class, "sendMeACodeButton")]'

try:
    dropdown = WebDriverWait(driver, 5).until(EC.element_to_be_clickable((By.XPATH, dropdown_xpath)))
    time.sleep(2)
    select = Select(dropdown)
    try:
        select.select_by_value('primaryEmail')
    except NoSuchElementException as e:
        print(f"Error: {e}")

    send_code_button = wait.until(EC.element_to_be_clickable((By.XPATH, send_code_button_xpath)))
    send_code_button.click()
    submit_code_and_verify()
except TimeoutException:
    print("Dropdown did not appear within 5 seconds, continuing with the rest of the program.")


# Wait to ensure the page is fully loaded
try:
    # Wait up to 30 seconds for the modal to appear
    WebDriverWait(driver, 15).until(
        EC.presence_of_element_located((By.CLASS_NAME, 'modal-content'))
    )
    
    # If the modal is found, locate and click the close button
    close_button = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.CSS_SELECTOR, 'button.close'))
    )
    close_button.click()
    print("Modal closed successfully.")

except TimeoutException:
    print("Modal did not appear within the timeout period.")
except NoSuchElementException:
    print("Close button not found.")

def reset_task_view():
    time.sleep(2)
    tasks_button_xpath = '//*[@id="pl-actionCenter"]/a/span[2]'
    tasks_button = wait.until(EC.element_to_be_clickable((By.XPATH, tasks_button_xpath)))
    tasks_button.click()
    time.sleep(3)
    
    view_rows_xpath = '//*[@id="pl-actioncenter"]/div[2]/div[2]/a'
    view_rows = WebDriverWait(driver, 90).until(EC.element_to_be_clickable((By.XPATH, view_rows_xpath)))
    view_rows.click()
    time.sleep(2)
    
    paging_panel_xpath = '//span[@class="ag-paging-row-summary-panel" and @role="status"]'
    WebDriverWait(driver, 60).until(EC.visibility_of_element_located((By.XPATH, paging_panel_xpath)))

reset_task_view()
time.sleep(5)

iframe_xpath = '//iframe[@id="ssoIframe"]'
rows_xpath = '//div[@role="row" and contains(@class, "ag-row")]'
disbursement_requests_col_xpath = './/div[@col-id="disbursement_request"]//a'
plan_name_xpath = './/div[@col-id="plan_name"]//span'
action_items_segment_xpath = '//div[@class="ui bottom attached segment active tab"]'
online_requests_xpath = '(//div[@class="ui equal width grid"])[1]//a[@data-testid="a-payroll-link"]'
paper_requests_xpath = '(//div[@class="ui equal width grid"])[2]//a[@data-testid="a-payroll-link"]'
online_action_items_button_xpath = '//a[@data-testid="a-payroll-link" and text()="Disbursement action items - Online"]'
participant_name_xpath = './/td[7]/font/a'
method_xpath = './/td[10]/font/a'
approval_request_date_xpath = './/td[12]/font/a'
reason_xpath = './/td[9]/font/a'
new_table_xpath = '//table[@width="100%" and @border="0" and @cellspacing="0" and @cellpadding="3"]/tbody/tr[contains(@class, "evenRowBgColor") or contains(@class, "oddRowBgColor")]'
home_button_link_text = 'Home'
next_button_xpath = '//div[@ref="btNext" and contains(@class, "ag-button ag-paging-button")]'
online_requests_count_xpath = '(//div[@class="ui equal width grid"])[1]//div[@class="one wide column"]'
paper_requests_count_xpath = '(//div[@class="ui equal width grid"])[2]//div[@class="one wide column"]'

df = pd.DataFrame(columns=["Plan", "Request Type", "Participant Name", "Method", "Reason", "Approval Request Date"])

# Load all .xlsx files in the specified directory
df_yesterday = pd.DataFrame(columns=df.columns)
if os.path.exists(yesterday_file_path):
    for file in os.listdir(yesterday_file_path):
        if file.endswith(".xlsx"):
            file_path = os.path.join(yesterday_file_path, file)
            temp_df = pd.read_excel(file_path)
            df_yesterday = pd.concat([df_yesterday, temp_df], ignore_index=True)
    df_yesterday['Approval Request Date'] = df_yesterday['Approval Request Date'].apply(
        lambda x: x.strftime('%m/%d/%Y') if isinstance(x, datetime) else 
                  datetime.strptime(str(x), '%m/%d/%Y').strftime('%m/%d/%Y') if isinstance(x, str) and x != "-" else x
    )


# Updated XPath for row count
row_count_xpath = '//span[@class="ag-paging-row-summary-panel"]'
row_count_element = driver.find_element(By.XPATH, row_count_xpath)
total_rows = int(row_count_element.text.split(' ')[-1])

for i in (range(total_rows)):
    print(i)
    if i > 9:
        num_clicks = i // 10  # Determine how many times to click based on the value of i
        print(f'should click next button {num_clicks} time(s)')
        next_button_xpath = '//span[@class="ag-icon ag-icon-next" and @role="presentation"]'
        
        for click in range(num_clicks):
            for attempt in range(3):  # Retry mechanism for each click
                try:
                    next_button = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, next_button_xpath)))
                    driver.execute_script("arguments[0].scrollIntoView(true);", next_button)  # Scroll into view
                    next_button.click()
                    print(f'next button clicked {click + 1} time(s)')
                    time.sleep(4)  # Adjust the sleep time if necessary
                    break
                except (StaleElementReferenceException, TimeoutException):
                    print(f"Retrying to click next button, attempt {attempt + 1}")

    retry_attempts = 3
    disbursement_request_true = False
    while retry_attempts > 0:
        try:
            rows = driver.find_elements(By.XPATH, rows_xpath)
            row = rows[i % 10]

            plan_name_element = row.find_element(By.XPATH, plan_name_xpath)
            current_plan = plan_name_element.text

            try:
                disbursement_request_element = row.find_element(By.XPATH, disbursement_requests_col_xpath)
            except NoSuchElementException:
                print(f"No disbursement request element found for row {i}. Moving to the next row.")
                break  # Skip the rest of the loop and move to the next row

            if disbursement_request_element.is_displayed() and disbursement_request_element.is_enabled():
                disbursement_request_true = True
                disbursement_request_element.click()
                print(current_plan)
                try:
                    WebDriverWait(driver, 60).until(EC.visibility_of_element_located((By.XPATH, online_requests_count_xpath)))
                    WebDriverWait(driver, 60).until(EC.visibility_of_element_located((By.XPATH, paper_requests_count_xpath)))
                    break
                except TimeoutException:
                    retry_attempts -= 1
                    if retry_attempts == 0:
                        print(f"Failed to process row {i + 1} after 3 attempts.")
                    try:
                        home_button = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.LINK_TEXT, home_button_link_text)))
                        home_button.click()
                    except TimeoutException:
                        print("Home button not clickable. Continuing to reset task view.")
                    reset_task_view()
                    time.sleep(7)
            else:
                print(f"Disbursement request element not clickable for row {i}. Moving to the next row.")
                try:
                    home_button = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.LINK_TEXT, home_button_link_text)))
                    home_button.click()
                except TimeoutException:
                    print("Home button not clickable. Continuing to reset task view.")
                reset_task_view()
                time.sleep(5)
                break  # Skip the rest of the loop and move to the next row
        except (NoSuchElementException, NoSuchWindowException, StaleElementReferenceException):
            print('No element found or window closed or stale element reference.')
            break
    if disbursement_request_true:
        try:
            online_requests_count_element = driver.find_element(By.XPATH, online_requests_count_xpath)
            paper_requests_count_element = driver.find_element(By.XPATH, paper_requests_count_xpath)
        except NoSuchElementException:
            print(f"No request count elements found for row {i}. Moving to the next row.")
            continue  # Skip the rest of the loop and move to the next row
    
        online_requests = int(online_requests_count_element.text)
        paper_requests = int(paper_requests_count_element.text)
    
        if paper_requests > 0:
            paper_requests_element = driver.find_element(By.XPATH, paper_requests_xpath)
            for _ in range(paper_requests):
                df = pd.concat([df, pd.DataFrame([[current_plan, "-", "-", "Paper", "-","-"]], columns=df.columns)], ignore_index=True)
         # If there are no online requests, return home and process the next row
        if online_requests == 0:
            try:
                home_button = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.LINK_TEXT, home_button_link_text)))
                home_button.click()
            except TimeoutException:
                print("Home button not clickable. Continuing to reset task view.")
            reset_task_view()
            time.sleep(5)
            continue  # Move to the next row
        
        if online_requests > 0:
            online_action_items_button = driver.find_element(By.XPATH, online_action_items_button_xpath)
            online_action_items_button.click()
            WebDriverWait(driver, 60).until(EC.visibility_of_element_located((By.XPATH, iframe_xpath)))
    
            iframe = driver.find_element(By.XPATH, iframe_xpath)
            driver.switch_to.frame(iframe)
    
            try:
                WebDriverWait(driver, 60).until(EC.visibility_of_element_located((By.XPATH, new_table_xpath)))
            except TimeoutException:
                print("TimeoutException: The new table did not appear in the expected time.")
                continue
    
            table_rows = driver.find_elements(By.XPATH, new_table_xpath)
            new_entries = []
            for table_row in table_rows:
                try:
                    participant_name_element = table_row.find_element(By.XPATH, participant_name_xpath)
                    method_element = table_row.find_element(By.XPATH, method_xpath)
                    approval_request_date_element = table_row.find_element(By.XPATH, approval_request_date_xpath)
                    reason_element = table_row.find_element(By.XPATH, reason_xpath)
    
                    participant_name = participant_name_element.text
                    method = method_element.text
                    approval_request_date = datetime.strptime(approval_request_date_element.text, '%m/%d/%Y').strftime('%m/%d/%Y')
                    reason = reason_element.text
    
                    new_entry = [current_plan, "Online", participant_name, method, reason, approval_request_date]
                    new_entries.append(new_entry)
                except NoSuchElementException:
                    print("Error extracting details from the new table row.")
            
            # Check for duplicates and add above matching requests
            for new_entry in new_entries:
                new_entry_date = datetime.strptime(new_entry[5], '%m/%d/%Y').strftime('%m/%d/%Y')
                if not ((df_yesterday['Participant name:'] == new_entry[2]) & 
                        (df_yesterday['Request Date'] == new_entry_date)).any():
                    df = pd.concat([pd.DataFrame([new_entry], columns=df.columns), df], ignore_index=True)


            driver.switch_to.default_content()
            try:
                home_button = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.LINK_TEXT, home_button_link_text)))
                home_button.click()
            except TimeoutException:
                print("Home button not clickable. Continuing to reset task view.")
            reset_task_view()
            time.sleep(5)

driver.quit()
# Reorder and rename columns
df = df.reindex(columns=["Plan", "Participant Name", "Reason", "Request Type", "Approval Request Date"])
df["Carrier"] = 'Empower'
df["Notes"] = ""
df["Assigned"] = ""

df = df.rename(columns={
    "Plan": "Plan Name",
    "Participant Name": "Participant name:",
    "Reason": "Type of Request",
    "Request Type": "Paper or Online",
    "Approval Request Date": "Request Date"
})

# Reorder columns with 'Carrier' between 'Participant name:' and 'Type of Request'
df = df.reindex(columns=["Plan Name", "Participant name:", "Carrier", "Type of Request", "Paper or Online", "Request Date", "Notes", "Assigned"])

# Save to Excel
df.to_excel(output_path, index=False)
print("Data saved to Excel.")
