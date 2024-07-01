import pandas as pd

def run_script():
    df = pd.DataFrame({'Column1': [1, 2], 'Column2': [3, 4]})
    df.to_csv('output.csv')
    return "Script executed successfully!"

if __name__ == "__main__":
    print(run_script())

