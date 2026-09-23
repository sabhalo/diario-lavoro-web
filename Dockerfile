FROM nginx:stable-alpine

COPY index.html styles.css sw.js /usr/share/nginx/html/
COPY src/ /usr/share/nginx/html/src/
COPY docs/ /usr/share/nginx/html/docs/
