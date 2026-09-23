FROM nginx:stable-alpine

COPY index.html styles.css sw.js /usr/share/nginx/html/
COPY src/ /usr/share/nginx/html/src/
COPY diagnostics/ /usr/share/nginx/html/diagnostics/
COPY docs/ /usr/share/nginx/html/docs/
COPY test/fixtures/italian-synthetic.wav /usr/share/nginx/html/test/fixtures/italian-synthetic.wav
