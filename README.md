# Excel Plotter Chatbot

## Project Description

The Excel Plotter Chatbot is an innovative application that combines natural language processing with data visualization. It allows users to interact with their Excel data through a chatbot interface, generating charts and graphs based on natural language queries. This project leverages advanced language models and plotting libraries to create a seamless experience for data analysis and visualization.

## Images

### Home page
![Home page](https://github.com/Transcendental-Programmer/LLM-Integrated-Excel-Plotter-App/blob/main/static/images/home.png.png)

### Sample Query
![Sample Query](https://github.com/Transcendental-Programmer/LLM-Integrated-Excel-Plotter-App/blob/main/static/images/sample-query.png)

### Result
![Result](https://github.com/Transcendental-Programmer/LLM-Integrated-Excel-Plotter-App/blob/main/static/images/result.png)

## Features

- Natural language interface for querying Excel data
- Dynamic chart generation based on user queries
- Support for various chart types (line, bar, etc.)
- Real-time data processing and visualization
- Integration of LLM (Large Language Model) for query understanding
- Image verification to ensure chart accuracy

## Models Used

1. **BART (facebook/bart-large)**: Fine-tuned for understanding and processing natural language queries related to data visualization.
2. **CLIP (openai/clip-vit-base-patch32)**: Used for image verification to ensure the generated charts match the user's query.

## Workflow

### Backend


1. **train_model.py**:
   - Script for fine-tuning the BART model on custom dataset and the model is saved as fine-tuned-bart-large

2. **app.py**: 
   - Initializes Flask application
   - Defines API endpoints for handling requests
   - Manages static file serving

3. **llm_agent.py**:
   - Processes user queries using the fine-tuned BART model
   - Coordinates between data processing, chart generation, and image verification

4. **data_processor.py**:
   - Handles loading and preprocessing of Excel data

5. **chart_generator.py**:
   - Generates charts based on processed queries using Matplotlib

6. **image_verifier.py**:
   - Verifies generated charts against user queries using CLIP model
    
7. Now one can see the chart posted on the app


### Frontend

1. **index.js**:
   - Entry point for React application

2. **App.js**:
   - Main component managing overall application state

3. **Chatbot.js**:
   - Handles user input and communication with backend API

4. **ChartDisplay.js**:
   - Renders the generated chart image

## Usage Instructions

1. Enter your query in natural language (e.g., "plot the sales in the years with red line")
2. The system processes your query and generates a relevant chart
3. The chart is displayed on the screen

## Cold Start Handling (HF Spaces + Vercel)

This project includes first-request cold start handling for Hugging Face Spaces free tier:

1. Backend wake endpoint:
   - `GET /health` in `llm-excel-plotter-agent/app.py`
   - Lightweight and safe for pings (no model inference)

2. Frontend sleep detection and retries:
   - `frontend/src/api/client.js` performs health checks and request retries
   - Exponential backoff with jitter for retryable failures (`408/429/5xx` or network timeouts)
   - Shows user-facing status like `Waking up server...` while backend resumes

3. Optional warm-up systems:
   - Browser interval warm-up: set `REACT_APP_WARMUP_INTERVAL_MS` (minimum enforced: 60000 ms)
   - Vercel cron warm-up: `frontend/vercel.json` + `frontend/api/warmup.js`

### Deploy Config

Set these values in Vercel frontend project environment variables:

- `REACT_APP_API_URL=https://<your-hf-space>.hf.space`
- `REACT_APP_WARMUP_INTERVAL_MS=0` (set to `0` to disable browser warm-up)
- `BACKEND_HEALTH_URL=https://<your-hf-space>.hf.space/health`
- `CRON_SECRET=<strong-random-secret>`

Set these values in Hugging Face Space settings (if not already set):

- Existing model/API keys as required (`GEMINI_API_KEY`, `GROK_API_KEY`)

### Why this minimizes load

- Health pings are debounced client-side for 90 seconds after successful calls.
- Warm-up interval pings only run when the tab is visible and online.
- Retries are only triggered for retryable transient errors.
- Health endpoint is intentionally lightweight.

## Project Setup

### Cloning the Repository

```bash
git clone https://github.com/Transcendental-Programmer/LLM-Integrated-Excel-Plotter-App.git
cd LLM-Integrated-Excel-Plotter-App
```

### Backend Setup

1. Create a virtual environment:
   ```
   python -m venv myenv
   myenv\Scripts\activate
   ```

2. Install required packages:
   ```
   pip install -r requirements.txt
   ```

3. Set up environment variables:
   Create a `.env` file in the backend directory and add the hugging face API key, you can get one for free from the web https://huggingface.co/.


4. change to backend
   ```
   cd backend
   ```
5. Run the train_model.py
   ```
   python train_model.py
   ```
6. Run the backend server:
   ```
   python app.py
   ```

The API should now be running on `http://localhost:5000`.

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```
Interact with the app opened on `http://localhost:8080`

## Contributing

Contributions to improve the Excel Plotter Chatbot are welcome. Please feel free to submit pull requests or open issues to discuss proposed changes.

## License

[MIT License](LICENSE)
