FROM python:3.12-slim

# Install pinned pytest in the base image so isolated runs need zero network access
RUN pip install --no-cache-dir pytest==8.3.4

# Create unprivileged user and restricted workspace mountpoint
RUN groupadd -g 65534 sandboxgroup || true \
    && useradd -u 65534 -g 65534 -M -s /usr/sbin/nologin sandboxuser || true \
    && mkdir -p /runner /workspace \
    && chmod 0755 /runner /workspace

COPY runner.py /runner/runner.py
RUN chmod 0555 /runner/runner.py

USER 65534:65534
WORKDIR /workspace

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONNOUSERSITE=1 \
    PYTHONIOENCODING=utf-8 \
    HOME=/nonexistent

ENTRYPOINT ["python3", "/runner/runner.py"]
