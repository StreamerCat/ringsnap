FROM python:3.12-slim

WORKDIR /app

# Use the same frozen dependency set tested in CI, including patched CA stores.
RUN pip install --no-cache-dir uv==0.13.5
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app/src"

# Copy source
COPY src/ ./src/
COPY config/ ./config/

# Non-root user
RUN useradd -m -u 1001 opsflow
USER opsflow

EXPOSE 8080

CMD ["python", "-m", "uvicorn", "ringsnap_ops_flow.main:app", "--host", "0.0.0.0", "--port", "8080"]
