FROM python:3.12-slim

RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir uv -i https://pypi.tuna.tsinghua.edu.cn/simple

COPY pyproject.toml ./
RUN uv pip install --system --no-cache . -i https://pypi.tuna.tsinghua.edu.cn/simple

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
