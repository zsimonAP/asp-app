#PRINCIPAL
import os
import time
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support.ui import Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException
from datetime import datetime, timedelta
import re
from datetime import datetime

print("WAIT_FOR_INPUT:Enter your username", flush=True)
username = input()
print("WAIT_FOR_INPUT:Enter your password", flush=True)
password = input()
output_path = 'C:\\Users\\zsimon\\Desktop\\Automation_Projects\\Distributions_Scripts\\Principal\\Principal_Tasks.xlsx'
keywords = [
    "provide loan information", 
    "provide withdrawal information", 
    "finalize distribution information"
]

def get_auth_code():
    while True:
        print("WAIT_FOR_INPUT:Please enter your 6-digit authentication code: ", flush=True)
        auth_code = input()
        if len(auth_code) == 6 and auth_code.isdigit():
            return auth_code
        else:
            print("Invalid input. Please ensure you enter exactly 6 digits.")

def submit_code_and_verify():
    code_input_xpath = '//*[@id="input112"]'
    verify_button_xpath = '//input[@value="Verify"]'
    error_message_xpath = '//div[@class="okta-form-infobox-error infobox infobox-error"]'

    while True:
        auth_code = get_auth_code()
        
        code_input_field = WebDriverWait(driver, 10).until(EC.visibility_of_element_located((By.XPATH, code_input_xpath)))
        code_input_field.clear()
        code_input_field.send_keys(auth_code)

        verify_button = driver.find_element(By.XPATH, verify_button_xpath)
        verify_button.click()

        try:
            WebDriverWait(driver, 3).until(EC.visibility_of_element_located((By.XPATH, error_message_xpath)))
            print("We found some errors. Please review below and make corrections.")
        except TimeoutException:
            print("Code verified successfully.")
            break

# Initialize WebDriver
driver = webdriver.Edge()
driver.get('https://accounts.principal.com/app/bookmark/0oadm2qe1orihoKba5d7/login')

username_xpath = '//*[@id="input28"]'
checkbox_xpath = '//*[@id="form20"]/div[1]/div[3]/div[2]/div/span/div'
accept_btn_id = 'onetrust-accept-btn-handler'
next_xpath = '//*[@id="form20"]/div[2]/input'

time.sleep(2)
wait = WebDriverWait(driver, 10)
username_field = wait.until(EC.visibility_of_element_located((By.XPATH, username_xpath)))
username_field.send_keys(username)

try:
    accept_button = WebDriverWait(driver, 5).until(EC.visibility_of_element_located((By.ID, accept_btn_id)))
    accept_button.click()
except TimeoutException:
    print("Accept button did not appear in time.")

checkbox = wait.until(EC.visibility_of_element_located((By.XPATH, checkbox_xpath)))
checkbox.click() 

next_button = wait.until(EC.visibility_of_element_located((By.XPATH, next_xpath)))
next_button.click()

password_xpath = '//*[@id="input61"]'
verify_xpath = '//*[@id="form53"]/div[2]'

password_field = wait.until(EC.visibility_of_element_located((By.XPATH, password_xpath)))
password_field.send_keys(password)
verify_button = wait.until(EC.visibility_of_element_located((By.XPATH, verify_xpath)))
verify_button.click()

google_authenticator_xpath = '//div[@data-se="google_otp"]//a[@data-se="button"]'

google_authenticator_button = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, google_authenticator_xpath)))
google_authenticator_button.click()

wait.until(EC.visibility_of_element_located((By.XPATH, '//*[@id="form104"]/div[1]/div[4]/div/div[2]/span')))
submit_code_and_verify()

view_tasks_xpath = '//*[@id="main"]/div/div[1]/div[1]/div/div[3]/a'
view_tasks_button = wait.until(EC.visibility_of_element_located((By.XPATH, view_tasks_xpath)))
view_tasks_button.click()

all_tasks_xpath = '//*[@id="alltasksBtn"]'
all_tasks_button = wait.until(EC.visibility_of_element_located((By.XPATH, all_tasks_xpath)))
all_tasks_button.click()

dropdown_xpath = '//*[@name="tasksTable_length"]'
dropdown_element = WebDriverWait(driver, 10).until(EC.visibility_of_element_located((By.XPATH, dropdown_xpath)))
select = Select(dropdown_element)
select.select_by_value("100")

checked_out_option_xpath = '//*[@id="tasksTable"]/thead/tr/th[5]/div'
checked_out_option = wait.until(EC.visibility_of_element_located((By.XPATH, checked_out_option_xpath)))
checked_out_option.click()

# Extract the table data
tasks_table_xpath = '//*[@id="tasksTable"]/tbody/tr'
tasks_rows = wait.until(EC.presence_of_all_elements_located((By.XPATH, tasks_table_xpath)))

# Prepare to collect data
data_to_write = []

while True:
    # Extract the table data
    tasks_table_xpath = '//*[@id="tasksTable"]/tbody/tr'
    tasks_rows = wait.until(EC.presence_of_all_elements_located((By.XPATH, tasks_table_xpath)))

    for row in tasks_rows:
        columns = row.find_elements(By.TAG_NAME, "td")
        start_date = columns[0].text.strip()
        task = columns[1].text.strip().lower()
        plan = columns[2].text.strip()
        participant = columns[3].text.strip()
        checked_out = columns[4].text.strip()

        if checked_out == "": #or checked_out.upper() == "SIMON, ZACH":
            for keyword in keywords:
                if keyword in task:
                    clean_task = keyword
                    data_to_write.append([start_date, clean_task, plan, participant, 'No'])
                    break

    # Check if there are more than 100 tasks
    tasks_info_xpath = '//*[@id="tasksTable_info"]'
    tasks_info = wait.until(EC.visibility_of_element_located((By.XPATH, tasks_info_xpath)))
    tasks_text = tasks_info.text
    total_tasks = int(tasks_text.split()[-2])

    if total_tasks <= 100:
        break

    # Click the "Next" button to load more tasks if there are more than 100 tasks
    next_button_xpath = '//*[@id="tasksTable_next"]'
    next_button = wait.until(EC.element_to_be_clickable((By.XPATH, next_button_xpath)))

    if 'ui-state-disabled' in next_button.get_attribute('class'):
        break

    next_button.click()
    time.sleep(3)  # Adding sleep to ensure the next set of tasks loads

# Write data to Excel
if data_to_write:
    df = pd.DataFrame(data_to_write, columns=['Start Date', 'Task', 'Plan', 'Participant', 'Hardship (Yes/No)'])
    df.to_excel(output_path, index=False)
    print(f"Data written to {output_path}")
else:
    print("No matching tasks found to write to the Excel file.")

# Function to update the hardship column
def update_hardship_column(participant_name):
    df = pd.read_excel(output_path)
    df.loc[df['Participant'] == participant_name, 'Hardship (Yes/No)'] = 'Yes'
    df.to_excel(output_path, index=False)

# Function to reset the task view
def reset_task_view():
    all_tasks_button = wait.until(EC.visibility_of_element_located((By.XPATH, all_tasks_xpath)))
    all_tasks_button.click()
    dropdown_element = WebDriverWait(driver, 10).until(EC.visibility_of_element_located((By.XPATH, dropdown_xpath)))
    select = Select(dropdown_element)
    select.select_by_value("100")
    checked_out_option = wait.until(EC.visibility_of_element_located((By.XPATH, checked_out_option_xpath)))
    checked_out_option.click()


    
# Load the tasks file to get the list of participant names
tasks_df = pd.read_excel(output_path)
participant_names = tasks_df['Participant'].unique()


# Loop through each participant in the Excel file
for participant_name in participant_names:
    print(f"Working on participant: {participant_name}")
    
    # Reset the task view for each participant
    reset_task_view()
    
    # Iterate through tasks to find the participant
    found_participant = False
    
    while not found_participant:
        # Extract the table data
        tasks_table_xpath = '//*[@id="tasksTable"]/tbody/tr'
        tasks_rows = wait.until(EC.presence_of_all_elements_located((By.XPATH, tasks_table_xpath)))

        for row in tasks_rows:
            columns = row.find_elements(By.TAG_NAME, "td")
            plan = columns[2].text.strip()
            participant = columns[3].text.strip()
        
            if participant.lower() == participant_name.lower():
                main_window = driver.current_window_handle
                work_on_task_button = row.find_element(By.XPATH, ".//a[contains(@class, 'claimTask')]")
                work_on_task_button.click()
                time.sleep(5)

                # Switch to the new pop-up window
                for handle in driver.window_handles:
                    if handle != main_window:
                        driver.switch_to.window(handle)
                        break
                
                popup_html = driver.page_source
                if "hardship" in popup_html.lower():
                    update_hardship_column(participant_name)
                    print('Hardship updated')
                
                # Close the pop-up window
                driver.close()
                
                # Switch back to the main window
                driver.switch_to.window(main_window)
                
                found_participant = True
                break

        if not found_participant:
            # Check if there are more than 100 tasks
            tasks_info_xpath = '//*[@id="tasksTable_info"]'
            tasks_info = wait.until(EC.visibility_of_element_located((By.XPATH, tasks_info_xpath)))
            tasks_text = tasks_info.text
            total_tasks = int(tasks_text.split()[-2])

            if total_tasks <= 100:
                print(f"Participant {participant_name} not found in the current task list.")
                break

            # Click the "Next" button to load more tasks if there are more than 100 tasks
            next_button_xpath = '//*[@id="tasksTable_next"]'
            next_button = wait.until(EC.element_to_be_clickable((By.XPATH, next_button_xpath)))

            if 'ui-state-disabled' in next_button.get_attribute('class'):
                print(f"Participant {participant_name} not found in the current task list.")
                break

            next_button.click()
            time.sleep(3)  # Adding sleep to ensure the next set of tasks loads
driver.quit()
# Define the file paths
today_date = datetime.today().strftime('%m-%d-%Y')
request_spreadsheet_path = f"W:\\Zach\\Distributions\\Request Spreadsheet {today_date} Morning.xlsx"

# Load the existing request spreadsheet
if os.path.exists(request_spreadsheet_path):
    request_df = pd.read_excel(request_spreadsheet_path)
    request_df.columns = request_df.columns.str.strip()  # Strip any leading/trailing spaces from column names
else:
    # Create an empty DataFrame with the required columns if the file doesn't exist
    request_df = pd.DataFrame(columns=[
        'Request Date', 'Plan Name', 'Participant Name: ', 'Carrier: ', 'Type of Request: ',
        'Paper or Online: ', 'Notes: ', 'Status Type', 'Plan Number', 'Hardship (Yes/No)'
    ])

# Load the tasks.xlsx file
tasks_df = pd.read_excel(output_path)
tasks_df.columns = tasks_df.columns.str.strip()  # Strip any leading/trailing spaces from column names

# Create a new DataFrame with the required columns and ensure no duplicate column names
df_new = pd.DataFrame({
    'Request Date': tasks_df['Start Date'],
    'Plan Name': tasks_df['Plan'],
    'Participant Name': tasks_df['Participant'],
    'Carrier': 'Principal',
    'Type of Request': tasks_df['Task'],
    'Paper or Online': 'Online',
    'Notes': '-',
    'Status Type': '-',
    'Plan Number': '-',
    'Hardship (Yes/No)': tasks_df['Hardship (Yes/No)']
})

# Ensure column names of df_new match request_df
df_new.columns = [col.strip() for col in df_new.columns]

# Append the new data to the existing request spreadsheet
request_df = pd.concat([request_df, df_new], ignore_index=True)

# Save the updated request spreadsheet
request_df.to_excel(request_spreadsheet_path, index=False)
print(f"Data appended to {request_spreadsheet_path}")