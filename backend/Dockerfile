FROM python:3.10-slim

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

RUN mkdir -p /app/data/uploads /app/static/images

ENV TRANSFORMERS_CACHE=/app/.cache/huggingface/transformers
ENV HF_HOME=/app/.cache/huggingface

EXPOSE 7860

CMD ["python", "app.py"]