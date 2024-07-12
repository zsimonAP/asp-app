import pandas as pd
import os

def run_script():
    # Path to the Desktop directory
    desktop_path = os.path.join(os.path.expanduser("~"), "Desktop")
    output_file_path = os.path.join(desktop_path, 'output.csv')
    
    # Create DataFrame
    df = pd.DataFrame({'Column1': [1, 2], 'Column2': [3, 4]})
    
    # Save DataFrame to CSV
    df.to_csv(output_file_path, index=False)
    
    return "Script executed successfully!"

if __name__ == "__main__":
    print(run_script())
