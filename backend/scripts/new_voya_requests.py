# VOYA
import os
import time
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from datetime import datetime, timedelta

def get_date_from_user():
    while True:
        print("WAIT_FOR_INPUT:Please enter the date of the last spreadsheet (MM-DD-YYYY)", flush=True)
        date_str = input()
        try:
            date_obj = datetime.strptime(date_str, '%m-%d-%Y')
            return date_obj.strftime('%m-%d-%Y')
        except ValueError:
            try:
                date_obj = datetime.strptime(date_str, '%d-%m-%Y')
                return date_obj.strftime('%m-%d-%Y')
            except ValueError:
                try:
                    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                    return date_obj.strftime('%m-%d-%Y')
                except ValueError:
                    print("The date format is incorrect. Please enter the date in MM-DD-YYYY format.")

if __name__ == "__main__":
    # Populate the variable yesterday_date
    yesterday_date = get_date_from_user()

    # Existing variables
    user_id = 'zsimon'
    password = '41M@norlaneV'
    download_folder = "C:\\Users\\Zachary Simon\\Desktop\\VoyaRequests" 

    # Filename with today's date
    today_date = datetime.today().strftime('%m-%d-%Y')
    file_name = f"Request Spreadsheet {today_date} Morning.xlsx"

    # Initialize WebDriver
    driver = webdriver.Edge()
    driver.get('https://tpa.voya.com/static/etpaweb/login.fcc?TARGET=https%3A%2F%2Ftpa.voya.com%2Fetpaweb')

    # Login
    user_id_xpath = '//*[@id="body_wrap"]/div[3]/div[2]/div/form/div[1]/div[1]/input'
    password_xpath = '//*[@id="body_wrap"]/div[3]/div[2]/div/form/div[2]/div[1]/div[1]/input'
    go_button_xpath = '//*[@id="btnAcct"]'

    wait = WebDriverWait(driver, 10)
    user_id_field = wait.until(EC.visibility_of_element_located((By.XPATH, user_id_xpath)))
    password_field = wait.until(EC.visibility_of_element_located((By.XPATH, password_xpath)))
    user_id_field.send_keys(user_id)
    password_field.send_keys(password)
    driver.find_element(By.XPATH, go_button_xpath).click()

    # Wait for OTP prompt
    try:
        otp_prompt_xpath = '//h1[contains(text(), "Please enter the code below to verify your identity")]'
        WebDriverWait(driver, 10).until(EC.visibility_of_element_located((By.XPATH, otp_prompt_xpath)))
        print("OTP activated")
        while True:
            print("WAIT_FOR_INPUT:Please enter your one-time passcode (or type 'Send another' to request a new one)", flush=True)
            otp_code = input().strip()

            if otp_code.strip().upper() == "SEND ANOTHER":
                regenerate_otp_xpath = '//a[contains(@click.delegate, "regenerateTokenAction()") and contains(text(), "I didn\'t receive a passcode, send me another")]'
                driver.find_element(By.XPATH, regenerate_otp_xpath).click()
                print("A new passcode has been requested. Please check your messages.")
                continue

            otp_input_xpath = '//input[@name="otp.user.otp"]'
            otp_input_field = driver.find_element(By.XPATH, otp_input_xpath)
            otp_input_field.send_keys(otp_code)

            verify_button_xpath = '//button[@type="submit" and contains(text(), "VERIFY")]'
            driver.find_element(By.XPATH, verify_button_xpath).click()

            # Check for error messages
            try:
                error_xpath1 = '//div[contains(@class, "alert alert-danger") and contains(text(), "The submitted one time passcode is incorrect.")]'
                WebDriverWait(driver, 2).until(EC.visibility_of_element_located((By.XPATH, error_xpath1)))
                print("Incorrect OTP. Please try again.")
            except TimeoutException:
                try:
                    error_xpath2 = '//span[contains(@class, "help-block validation-message") and contains(text(), "Token must be numerical and six digits only.")]'
                    WebDriverWait(driver, 2).until(EC.visibility_of_element_located((By.XPATH, error_xpath2)))
                    print("OTP must be numerical and six digits only. Please try again.")
                except TimeoutException:
                    print("OTP verified successfully.")
                    break

        try:
            registration_prompt_xpath = '//h1[contains(text(), "Would you like to Register Your Computer or Mobile Device?")]'
            WebDriverWait(driver, 5).until(EC.visibility_of_element_located((By.XPATH, registration_prompt_xpath)))
            print("Register computer activated")

            while True:
                print("WAIT_FOR_INPUT:Would you like to register your computer or mobile device? (yes/no)", flush=True)
                register_choice = input().strip().lower()

                if register_choice == 'yes':
                    register_yes_xpath = '//input[@id="yes" and @value="consent"]'
                    driver.find_element(By.XPATH, register_yes_xpath).click()
                    break
                elif register_choice == 'no':
                    register_no_xpath = '//input[@id="no" and @value=" "]'
                    driver.find_element(By.XPATH, register_no_xpath).click()
                    break
                else:
                    print("Please enter 'yes' or 'no'.")

            continue_button_xpath = '//button[@type="submit" and contains(text(), "CONTINUE")]'
            driver.find_element(By.XPATH, continue_button_xpath).click()

        except TimeoutException:
            print("Registration prompt did not appear. Continuing with the rest of the program.")

    except TimeoutException:
        print("OTP prompt did not appear. Continuing with the rest of the program.")

    # Navigate to Distributions
    distributions_xpath = '//*[@id="chromemenu"]/ul/li[7]/a'
    wait = WebDriverWait(driver, 60)
    distributions_button = wait.until(EC.visibility_of_element_located((By.XPATH, distributions_xpath)))
    distributions_button.click()

    try:
        accept_cookies_xpath = '//a[@role="button" and contains(@class, "cc-btn") and contains(@class, "cc-allow")]'
        accept_cookies_button = WebDriverWait(driver, 2).until(
            EC.visibility_of_element_located((By.XPATH, accept_cookies_xpath))
        )
        accept_cookies_button.click()
    except:
        pass  # If the button does not appear, continue without clicking

    wait = WebDriverWait(driver, 60)
    view_all_xpath = '//*[@id="bottomNavControlsViewAll"]'
    view_all_button = wait.until(EC.visibility_of_element_located((By.XPATH, view_all_xpath)))

    driver.execute_script("arguments[0].scrollIntoView(true);", view_all_button)
    view_all_button.click()

    # Extract Data from Table
    table_xpath = '//*[@class="tabular8"]'
    wait.until(EC.visibility_of_element_located((By.XPATH, table_xpath)))

    rows = driver.find_elements(By.XPATH, f"{table_xpath}//tbody/tr")
    data = []
    for row in rows:
        cols = row.find_elements(By.TAG_NAME, 'td')
        if cols and len(cols) == 8:  # Ensure the row has the expected number of columns
            data.append([col.text for col in cols])

    # Create DataFrame
    columns = ["Request Date", "Participant Name", "Plan Name", "Plan Number", "Request Type", "Amount", "Status", "Status Type"]
    df = pd.DataFrame(data, columns=columns)

    # Remove 'xxx-xx-####' part from participant names
    df['Participant Name'] = df['Participant Name'].str.replace(r'\nxxx-xx-\d{4}', '', regex=True)

    # Reformat participant names from 'Last, First Middle' to 'First Last'
    def reformat_name(name):
        parts = name.split(',')
        if len(parts) == 2:
            last_name = parts[0].strip()
            first_middle_name = parts[1].strip()
            first_name = first_middle_name.split()[0]
            return f"{first_name} {last_name}"
        return name

    df['Participant Name'] = df['Participant Name'].apply(reformat_name)

    def reformat_date(date_str):
        for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%m/%d/%Y'):
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.date().strftime('%m/%d/%Y')
            except ValueError:
                pass
        raise ValueError(f"time data {date_str} does not match any expected format")

    df['Request Date'] = df['Request Date'].apply(reformat_date)

    # Create a new DataFrame with the required columns
    df_new = pd.DataFrame({
        'Request Date': df['Request Date'],
        'Plan Name': df['Plan Name'],
        'Participant Name': df['Participant Name'],
        'Carrier': 'Voya',
        'Type of Request': df['Request Type'],
        'Paper or Online': 'Online',
        'Notes': df['Status'],
        'Status Type': df['Status Type'],
        'Plan Number': df['Plan Number'],
        'Hardship (Yes/No)': '-'
    })

    # Write DataFrame to Excel with date formatting
    output_file = os.path.join(download_folder, file_name)
    with pd.ExcelWriter(output_file, engine='xlsxwriter') as writer:
        df_new.to_excel(writer, index=False)
        workbook = writer.book
        worksheet = writer.sheets['Sheet1']
        date_format = workbook.add_format({'num_format': 'mm/dd/yyyy'})
        worksheet.set_column('A:A', None, date_format)

    # Close the browser
    driver.quit()

    print(f"Data successfully extracted and saved to {output_file}")

    # Generate filenames based on today's and yesterday's dates
    today_date = datetime.today().strftime('%m-%d-%Y')

    today_file_name = f"Request Spreadsheet {today_date} Morning.xlsx"
    yesterday_file_name = f"Request Spreadsheet {yesterday_date} Morning.xlsx"

    today_file_path = os.path.join(download_folder, today_file_name)
    yesterday_file_path = os.path.join(download_folder, yesterday_file_name)

    # Load today's and yesterday's files
    df_today = pd.read_excel(today_file_path)
    df_yesterday = pd.read_excel(yesterday_file_path)

    # Rename columns to match
    df_yesterday.rename(columns={'Participant Name:': 'Participant Name', 'Carrier:': 'Carrier', 'Type of Request:': 'Type of Request', 'Paper or Online:': 'Paper or Online'}, inplace=True)

    # Convert participant names to uppercase for comparison
    df_today['Participant Name'] = df_today['Participant Name'].str.upper()
    df_yesterday['Participant Name'] = df_yesterday['Participant Name'].str.upper()

    # Convert request dates to datetime objects for comparison
    df_today['Request Date'] = pd.to_datetime(df_today['Request Date'], format='mixed')
    df_yesterday['Request Date'] = pd.to_datetime(df_yesterday['Request Date'], format='mixed')

    matching_index = None
    for index in range(1, len(df_yesterday)):
        participant_name_yesterday = df_yesterday.iloc[index]['Participant Name']
        request_type_yesterday = df_yesterday.iloc[index]['Type of Request']
        plan_number_yesterday = df_yesterday.iloc[index]['Plan Number']
        request_date_yesterday = df_yesterday.iloc[index]['Request Date']

        if participant_name_yesterday in df_today['Participant Name'].values:
            if 'Hardship' in request_type_yesterday or plan_number_yesterday.startswith(('PH', 'GH')):
                continue  # Skip this entry and continue with the next one

            request_date_today = df_today[df_today['Participant Name'] == participant_name_yesterday]['Request Date'].values[0]
            if request_date_today > request_date_yesterday:
                continue  # Skip this entry if today's request date is after yesterday's request date

            matching_index = df_today[df_today['Participant Name'] == participant_name_yesterday].index[0]
            print(f"First matching participant name found: {participant_name_yesterday} at index {matching_index}")
            break
    else:
        print("No matching participant name found.")

    if matching_index is not None:
        df_today = df_today.iloc[:matching_index]

        # Save the updated DataFrame to today's file
        df_today.to_excel(today_file_path, index=False)
        print(f"Entries after index {matching_index} have been deleted from today's file.")
        print("SCRIPT_COMPLETED", flush=True)
    else:
        print("No changes made to today's file.")
        print("SCRIPT_COMPLETED", flush=True)
