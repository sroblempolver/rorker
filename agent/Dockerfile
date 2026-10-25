# Plan-reading worker for Railway. Builds LibreDWG for DWG -> DXF conversion.
FROM python:3.12-slim AS dwg
ARG LIBREDWG=0.13.3
RUN apt-get update && apt-get install -y --no-install-recommends build-essential curl xz-utils ca-certificates \
 && curl -sSLf https://github.com/LibreDWG/libredwg/releases/download/${LIBREDWG}/libredwg-${LIBREDWG}.tar.xz | tar xJ \
 && cd libredwg-${LIBREDWG} && ./configure --disable-bindings --prefix=/opt/libredwg && make -j"$(nproc)" && make install

FROM python:3.12-slim
COPY --from=dwg /opt/libredwg /opt/libredwg
ENV PATH="/opt/libredwg/bin:${PATH}" LD_LIBRARY_PATH="/opt/libredwg/lib" PYTHONUNBUFFERED=1
WORKDIR /app
COPY pyproject.toml ./
COPY rorker_agent ./rorker_agent
RUN pip install --no-cache-dir .
CMD ["python", "-m", "rorker_agent", "worker"]
