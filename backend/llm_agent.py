import ast
import json
import logging
import os
import time

from dotenv import load_dotenv

from chart_generator import ChartGenerator
from data_processor import DataProcessor

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "You are a data visualization expert. "
    "Given the user request and the dataset schema provided, output ONLY a valid JSON "
    "object — no explanation, no markdown fences, no extra text.\n\n"
    "Required keys:\n"
    '  "x"          : string  — exact column name for the x-axis\n'
    '  "y"          : array   — one or more exact column names for the y-axis\n'
    '  "chart_type" : string  — one of: line, bar, scatter, pie, histogram, box, area\n'
    '  "color"      : string  — optional CSS color, e.g. "red", "#4f8cff"\n\n'
    "Rules:\n"
    "- Use only column names that appear in the schema. Never invent names.\n"
    "- For pie: y must contain exactly one column.\n"
    "- For histogram/box: x may equal the first element of y.\n"
    "- Default to line if chart type is ambiguous."
)


def _user_message(query: str, columns: list, dtypes: dict, sample_rows: list) -> str:
    schema = "\n".join(f"  - {c} ({dtypes.get(c, 'unknown')})" for c in columns)
    samples = "".join(f"  {json.dumps(r)}\n" for r in sample_rows[:3])
    return (
        f"Dataset columns:\n{schema}\n\n"
        f"Sample rows (first 3):\n{samples}\n"
        f"User request: {query}"
    )


# ---------------------------------------------------------------------------
# Output parsing & validation
# ---------------------------------------------------------------------------

def _parse_output(text: str):
    text = text.strip()
    if "```" in text:
        for part in text.split("```"):
            part = part.strip().lstrip("json").strip()
            if part.startswith("{"):
                text = part
                break
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    try:
        return ast.literal_eval(text)
    except (SyntaxError, ValueError):
        pass
    return None


def _validate(args: dict, columns: list):
    if not isinstance(args, dict):
        return None
    if not all(k in args for k in ("x", "y", "chart_type")):
        return None
    if isinstance(args["y"], str):
        args["y"] = [args["y"]]
    valid = {"line", "bar", "scatter", "pie", "histogram", "box", "area"}
    if args["chart_type"] not in valid:
        args["chart_type"] = "line"
    if args["x"] not in columns:
        return None
    if not all(c in columns for c in args["y"]):
        return None
    return args


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class LLM_Agent:
    def __init__(self, data_path=None):
        logger.info("Initializing LLM_Agent")
        self.data_processor = DataProcessor(data_path)
        self.chart_generator = ChartGenerator(self.data_processor.data)
        self._bart_tokenizer = None
        self._bart_model = None

    # -- model runners -------------------------------------------------------

    def _run_qwen(self, user_msg: str) -> str:
        from huggingface_hub import InferenceClient
        client = InferenceClient(token=os.getenv("HUGGINGFACEHUB_API_TOKEN"))
        resp = client.chat_completion(
            model="Qwen/Qwen2.5-1.5B-Instruct",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": user_msg},
            ],
            max_tokens=256,
            temperature=0.1,
        )
        return resp.choices[0].message.content

    def _run_gemini(self, user_msg: str) -> str:
        import google.generativeai as genai
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            "gemini-2.0-flash",
            system_instruction=_SYSTEM_PROMPT,
        )
        return model.generate_content(user_msg).text

    def _run_grok(self, user_msg: str) -> str:
        from openai import OpenAI
        api_key = os.getenv("GROK_API_KEY")
        if not api_key:
            raise ValueError("GROK_API_KEY is not set")
        client = OpenAI(api_key=api_key, base_url="https://api.x.ai/v1")
        resp = client.chat.completions.create(
            model="grok-3-mini",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": user_msg},
            ],
            max_tokens=256,
            temperature=0.1,
        )
        return resp.choices[0].message.content

    def _run_bart(self, query: str) -> str:
        if self._bart_model is None:
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
            model_id = "ArchCoder/fine-tuned-bart-large"
            logger.info("Loading BART model (first request)...")
            self._bart_tokenizer = AutoTokenizer.from_pretrained(model_id)
            self._bart_model = AutoModelForSeq2SeqLM.from_pretrained(model_id)
            logger.info("BART model loaded.")
        inputs = self._bart_tokenizer(
            query, return_tensors="pt", max_length=512, truncation=True
        )
        outputs = self._bart_model.generate(**inputs, max_length=100)
        return self._bart_tokenizer.decode(outputs[0], skip_special_tokens=True)

    # -- main entry point ----------------------------------------------------

    def process_request(self, data: dict) -> dict:
        t0        = time.time()
        query     = data.get("query", "")
        data_path = data.get("file_path")
        model     = data.get("model", "qwen")

        if data_path and os.path.exists(data_path):
            self.data_processor  = DataProcessor(data_path)
            self.chart_generator = ChartGenerator(self.data_processor.data)

        columns     = self.data_processor.get_columns()
        dtypes      = self.data_processor.get_dtypes()
        sample_rows = self.data_processor.preview(3)

        default_args = {
            "x":          columns[0] if columns else "Year",
            "y":          [columns[1]] if len(columns) > 1 else ["Sales"],
            "chart_type": "line",
        }

        raw_text  = ""
        plot_args = None
        try:
            user_msg = _user_message(query, columns, dtypes, sample_rows)
            if   model == "gemini": raw_text = self._run_gemini(user_msg)
            elif model == "grok":   raw_text = self._run_grok(user_msg)
            elif model == "bart":   raw_text = self._run_bart(query)
            else:                   raw_text = self._run_qwen(user_msg)

            logger.info(f"LLM [{model}] output: {raw_text}")
            parsed    = _parse_output(raw_text)
            plot_args = _validate(parsed, columns) if parsed else None
        except Exception as exc:
            logger.error(f"LLM error [{model}]: {exc}")
            raw_text = str(exc)

        if not plot_args:
            logger.warning("Falling back to default plot args")
            plot_args = default_args

        try:
            chart_result = self.chart_generator.generate_chart(plot_args)
            chart_path   = chart_result["chart_path"]
            chart_spec   = chart_result["chart_spec"]
        except Exception as exc:
            logger.error(f"Chart generation error: {exc}")
            return {
                "response":   f"Chart generation failed: {exc}",
                "chart_path": "",
                "chart_spec": None,
                "verified":   False,
                "plot_args":  plot_args,
            }

        logger.info(f"Request processed in {time.time() - t0:.2f}s")
        return {
            "response":   json.dumps(plot_args),
            "chart_path": chart_path,
            "chart_spec": chart_spec,
            "verified":   True,
            "plot_args":  plot_args,
        }
