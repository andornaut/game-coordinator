# syntax=docker/dockerfile:1.25
FROM koalaman/shellcheck:v0.11.0 AS shellcheck

FROM node:24.22.2
COPY --from=shellcheck /bin/shellcheck /usr/local/bin/shellcheck
RUN install -d -o 19001 -g 19001 /opt/check
WORKDIR /opt/check
COPY --chown=19001:19001 package.json package-lock.json ./
USER 19001:19001
ENV HOME=/tmp
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tests/container/check /opt/check/run
ENV PATH=/opt/check/node_modules/.bin:${PATH}
