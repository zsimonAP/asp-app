import os
import pandas as pd
import sys

def append_and_save_to_csv(file1, file2, output_file_name):
    # Read the two CSV files
    df1 = pd.read_csv(file1)
    df2 = pd.read_csv(file2)
    
    # Append the second DataFrame to the first
    appended_df = pd.concat([df1, df2], ignore_index=True)
    
    # Get the path to the user's desktop
    desktop_path = os.path.join(os.path.expanduser("~"), "Desktop")
    
    # Create the full output file path
    output_file_path = os.path.join(desktop_path, output_file_name)
    
    # Save the appended DataFrame to a new CSV file
    appended_df.to_csv(output_file_path, index=False)
    
    print(f"File saved to: {output_file_path}")

if __name__ == "__main__":
    # Trigger the first file input
    print("WAIT_FOR_FILE_INPUT:Please upload the first CSV file", flush=True)
    file1_path = input().strip()

    # Trigger the second file input
    print("WAIT_FOR_FILE_INPUT:Please upload the second CSV file", flush=True)
    file2_path = input().strip()

    output_file_name = "appended_output.csv"
    
    append_and_save_to_csv(file1_path, file2_path, output_file_name)
    print("SCRIPT_COMPLETED", flush=True)
