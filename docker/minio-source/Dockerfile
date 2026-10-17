# Build from pinned official source; no MinIO registry images are required.
FROM golang:1.24.9-bookworm AS build
ARG SOURCE_REPO
ARG SOURCE_COMMIT
ARG BINARY
ENV CGO_ENABLED=0 GOAMD64=v1 GOTOOLCHAIN=auto
WORKDIR /src
RUN git init . && git remote add origin "$SOURCE_REPO" \
    && git fetch --depth 1 origin "$SOURCE_COMMIT" && git checkout --detach FETCH_HEAD \
    && test "$(git rev-parse HEAD)" = "$SOURCE_COMMIT"
RUN go build -p 2 -trimpath -o /out/service .
RUN cp LICENSE /out/LICENSE && printf '%s\n%s\n' "$SOURCE_REPO" "$SOURCE_COMMIT" > /out/SOURCE
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && apt-get clean
ARG BINARY
COPY --from=build /out/service /usr/local/bin/service
COPY --from=build /out/LICENSE /usr/share/doc/minio-source/LICENSE
COPY --from=build /out/SOURCE /usr/share/doc/minio-source/SOURCE
RUN ln -s /usr/local/bin/service "/usr/local/bin/$BINARY"
ENTRYPOINT ["/usr/local/bin/service"]
