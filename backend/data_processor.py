import pandas as pd
import os
import logging

class DataProcessor:
    def __init__(self, data_path=None):
        logging.info("Initializing DataProcessor")
        # Allow dynamic data path (for user uploads), fallback to default
        if data_path and os.path.exists(data_path):
            self.data_path = data_path
        else:
            self.data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'sample_data.xlsx')
        self.data = self.load_data(self.data_path)

    def load_data(self, path):
        ext = os.path.splitext(path)[1].lower()
        try:
            if ext == '.csv':
                data = pd.read_csv(path)
            elif ext in ['.xls', '.xlsx']:
                data = pd.read_excel(path)
            else:
                raise ValueError(f"Unsupported file type: {ext}")
            logging.info(f"Loaded data from {path} with shape {data.shape}")
            return data
        except Exception as e:
            logging.error(f"Failed to load data: {e}")
            return pd.DataFrame()

    def validate_columns(self, required_columns):
        missing = [col for col in required_columns if col not in self.data.columns]
        if missing:
            logging.warning(f"Missing columns: {missing}")
            return False, missing
        return True, []

    def get_columns(self):
        return list(self.data.columns)

    def preview(self, n=5):
        return self.data.head(n).to_dict(orient='records')

    def get_dtypes(self) -> dict:
        result = {}
        for col, dtype in self.data.dtypes.items():
            if pd.api.types.is_integer_dtype(dtype):
                result[col] = "integer"
            elif pd.api.types.is_float_dtype(dtype):
                result[col] = "float"
            elif pd.api.types.is_datetime64_any_dtype(dtype):
                result[col] = "datetime"
            elif pd.api.types.is_bool_dtype(dtype):
                result[col] = "boolean"
            else:
                result[col] = "string"
        return result

    def get_stats(self) -> dict:
        numeric = self.data.select_dtypes(include='number')
        if numeric.empty:
            return {}
        desc = numeric.describe().to_dict()
        return {col: {k: round(v, 4) for k, v in stats.items()} for col, stats in desc.items()}

