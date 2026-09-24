"""Loopback-only HTTP adapter for a locally installed whisper.cpp whisper-cli.

Python 3.10+ standard library only. The configured URL is the complete endpoint:
GET and POST both use /asr (or --path), without implicit path rewriting.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import select
import socket
import subprocess
import tempfile
import time
import wave
from dataclasses import dataclass
from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import BoundedSemaphore
from urllib.parse import urlsplit


API = "diario-local-asr"
VERSION = 1
MAX_AUDIO_BYTES = 20_000_000
MAX_DURATION_SECONDS = 600
MAX_REQUEST_BYTES = MAX_AUDIO_BYTES + 16_384


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


@dataclass(frozen=True)
class Config:
    cli: Path
    model: Path
    origin: str
    host: str = "127.0.0.1"
    port: int = 8765
    path: str = "/asr"
    timeout: int = 900

    def validate(self) -> None:
        if self.host not in ("127.0.0.1", "::1"):
            raise ValueError("--host must be 127.0.0.1 or ::1")
        if not (1 <= self.port <= 65535):
            raise ValueError("--port must be between 1 and 65535")
        if not self.path.startswith("/") or self.path.startswith("//") or "?" in self.path or "#" in self.path:
            raise ValueError("--path must be an absolute path without query or fragment")
        parsed = urlsplit(self.origin)
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.path or parsed.query or parsed.fragment or parsed.username or parsed.password:
            raise ValueError("--origin must be one exact HTTP(S) origin, without path or credentials")
        if not (1 <= self.timeout <= 86400):
            raise ValueError("--timeout must be between 1 and 86400 seconds")

    @property
    def model_name(self) -> str:
        return self.model.name

    @property
    def ready(self) -> bool:
        # English-only .en checkpoints cannot be asked to recognize Italian.
        english_only = re.search(r"\.en(?:[.-]|$)", self.model.name, re.I)
        return self.cli.is_file() and self.model.is_file() and self.model.stat().st_size > 0 and not english_only


def validate_wav(raw: bytes) -> tuple[float, bool]:
    if len(raw) > MAX_AUDIO_BYTES:
        raise ApiError(413, "audio_too_large", "Audio exceeds the 20 MB request limit")
    try:
        with wave.open(io.BytesIO(raw), "rb") as wav:
            if wav.getcomptype() != "NONE" or wav.getnchannels() != 1 or wav.getsampwidth() != 2 or wav.getframerate() != 16000:
                raise ApiError(415, "unsupported_audio", "Expected uncompressed mono PCM16 WAV at 16000 Hz")
            remaining = wav.getnframes()
            duration = remaining / 16000
            if duration <= 0 or duration > MAX_DURATION_SECONDS:
                raise ApiError(413, "duration_limit", "Audio duration must be greater than 0 and at most 600 seconds")
            silent = True
            while remaining:
                frame_count = min(remaining, 32_768)
                frames = wav.readframes(frame_count)
                if len(frames) != frame_count * 2:
                    raise ApiError(415, "truncated_audio", "WAV sample data ends before its declared duration")
                if any(frames):
                    silent = False
                remaining -= frame_count
    except (EOFError, wave.Error) as exc:
        raise ApiError(415, "unsupported_audio", "Audio is not a valid PCM WAV") from exc
    return duration, silent


def parse_audio_multipart(content_type: str, payload: bytes) -> bytes:
    if not content_type.lower().startswith("multipart/form-data;"):
        raise ApiError(415, "unsupported_media_type", "Expected multipart/form-data")
    try:
        message = BytesParser(policy=default).parsebytes(
            b"Content-Type: " + content_type.encode("ascii") + b"\r\nMIME-Version: 1.0\r\n\r\n" + payload
        )
        if not message.is_multipart():
            raise ValueError("missing multipart boundary")
        parts = list(message.iter_parts())
        if len(parts) != 2:
            raise ValueError("expected audio and language fields")
        fields = {part.get_param("name", header="content-disposition"): part for part in parts}
        if set(fields) != {"audio", "language"}:
            raise ValueError("expected audio and language fields")
        language = fields["language"].get_payload(decode=True)
        if language != b"it":
            raise ApiError(422, "unsupported_language", "Only language=it is supported")
        audio_part = fields["audio"]
        if audio_part.get_content_type() not in ("audio/wav", "audio/wave", "audio/x-wav", "application/octet-stream"):
            raise ApiError(415, "unsupported_audio", "Audio field must contain a WAV file")
        if audio_part.get_filename() is None:
            raise ValueError("audio field must be a file")
        audio = audio_part.get_payload(decode=True)
        if not isinstance(audio, bytes):
            raise ValueError("invalid audio field")
        return audio
    except (UnicodeError, ValueError, TypeError) as exc:
        raise ApiError(400, "invalid_multipart", "Expected audio WAV file and language=it fields") from exc


def normalize_output(data: dict, duration: float, model_name: str) -> dict:
    if not isinstance(data, dict) or not isinstance(data.get("transcription"), list):
        raise ApiError(502, "invalid_engine_output", "whisper-cli did not return timed JSON segments")
    result = data.get("result", {})
    if not isinstance(result, dict):
        raise ApiError(502, "invalid_engine_output", "whisper-cli returned an invalid language result")
    result_language = result.get("language")
    if result_language and result_language != "it":
        raise ApiError(502, "wrong_language", "whisper-cli returned a non-Italian language")
    segments = []
    for item in data["transcription"]:
        try:
            offsets = item["offsets"]
            start = offsets["from"] / 1000
            end = offsets["to"] / 1000
            if not isinstance(offsets["from"], int) or not isinstance(offsets["to"], int):
                raise TypeError("invalid offsets")
            if not isinstance(item["text"], str):
                raise TypeError("invalid text")
            content = item["text"].strip()
        except (KeyError, TypeError, ValueError, ZeroDivisionError) as exc:
            raise ApiError(502, "invalid_engine_output", "whisper-cli returned invalid segment timing") from exc
        if not (0 <= start <= end <= duration):
            raise ApiError(422, "untrusted_timing", "whisper-cli returned text outside the audio interval; no transcript accepted")
        if content:
            segments.append({"start": start, "end": end, "text": content})
    return {
        "api": API,
        "version": VERSION,
        "language": "it",
        "model": model_name,
        "segments": segments,
        "text": " ".join(segment["text"] for segment in segments),
    }


def client_disconnected(connection: socket.socket) -> bool:
    try:
        readable, _, _ = select.select([connection], [], [], 0)
        return bool(readable) and not connection.recv(1, socket.MSG_PEEK)
    except (ConnectionError, OSError):
        return True


def run_whisper(config: Config, audio: bytes, duration: float, connection: socket.socket) -> dict:
    with tempfile.TemporaryDirectory(prefix="diario-asr-") as directory:
        wav_path = Path(directory) / "audio.wav"
        result_base = Path(directory) / "result"
        wav_path.write_bytes(audio)
        command = [str(config.cli), "-m", str(config.model), "-f", str(wav_path), "-l", "it", "-oj", "-of", str(result_base)]
        try:
            process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except OSError as exc:
            raise ApiError(503, "engine_unavailable", "Could not start whisper-cli") from exc
        deadline = time.monotonic() + config.timeout
        try:
            while process.poll() is None:
                if client_disconnected(connection):
                    raise ApiError(499, "client_cancelled", "Client disconnected")
                if time.monotonic() >= deadline:
                    raise ApiError(504, "engine_timeout", "whisper-cli exceeded its time limit")
                time.sleep(0.1)
            if process.returncode != 0:
                raise ApiError(502, "engine_failed", "whisper-cli failed; check local helper logs")
            result_path = Path(str(result_base) + ".json")
            try:
                data = json.loads(result_path.read_text(encoding="utf-8"))
            except (OSError, ValueError) as exc:
                raise ApiError(502, "invalid_engine_output", "whisper-cli did not write valid JSON") from exc
            return normalize_output(data, duration, config.model_name)
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


class AsrServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, config: Config):
        config.validate()
        self.address_family = socket.AF_INET6 if config.host == "::1" else socket.AF_INET
        super().__init__((config.host, config.port), AsrHandler)
        self.config = config
        self.job_lock = BoundedSemaphore(1)


class AsrHandler(BaseHTTPRequestHandler):
    server: AsrServer
    protocol_version = "HTTP/1.1"

    def _origin_allowed(self) -> bool:
        origin = self.headers.get("Origin")
        return origin is None or origin == self.server.config.origin

    def _host_allowed(self) -> bool:
        configured = self.server.config
        expected = f"[{configured.host}]:{configured.port}" if configured.host == "::1" else f"{configured.host}:{configured.port}"
        return self.headers.get("Host") in (expected, f"localhost:{configured.port}")

    def _path_allowed(self) -> bool:
        return self.path == self.server.config.path

    def _headers(self, status: int, size: int = 0) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if self.headers.get("Origin") == self.server.config.origin:
            self.send_header("Access-Control-Allow-Origin", self.server.config.origin)
            self.send_header("Vary", "Origin")
        self.end_headers()

    def _json(self, status: int, data: dict) -> None:
        body = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        try:
            self._headers(status, len(body))
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _error(self, error: ApiError) -> None:
        if error.status != 499:
            self._json(error.status, {"error": {"code": error.code, "message": error.message}})

    def _guard(self) -> bool:
        if not self._host_allowed():
            self.close_connection = True
            self._error(ApiError(400, "invalid_host", "Host must match the loopback listener"))
            return False
        if not self._path_allowed():
            self.close_connection = True
            self._error(ApiError(404, "unknown_endpoint", "Use the configured complete ASR URL"))
            return False
        if not self._origin_allowed():
            self.close_connection = True
            self._error(ApiError(403, "origin_denied", "Origin is not allowed"))
            return False
        return True

    def do_OPTIONS(self) -> None:
        if not self._guard():
            return
        if self.headers.get("Origin") != self.server.config.origin:
            self._error(ApiError(403, "origin_denied", "Origin is required for CORS preflight"))
            return
        requested = {x.strip().lower() for x in self.headers.get("Access-Control-Request-Headers", "").split(",") if x.strip()}
        if self.headers.get("Access-Control-Request-Method") != "POST" or not requested.issubset({"content-type"}):
            self._error(ApiError(400, "invalid_preflight", "Only POST with Content-Type is allowed"))
            return
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.send_header("Access-Control-Allow-Origin", self.server.config.origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Vary", "Origin")
        self.end_headers()

    def do_GET(self) -> None:
        if not self._guard():
            return
        config = self.server.config
        self._json(200, {
            "api": API, "version": VERSION, "ready": config.ready, "language": "it",
            "model": config.model_name if config.ready else None,
            "accept": ["audio/wav"], "maxAudioBytes": MAX_AUDIO_BYTES,
            "maxDurationSeconds": MAX_DURATION_SECONDS, "timestamps": True,
        })

    def do_POST(self) -> None:
        if not self._guard():
            return
        if self.headers.get("Origin") != self.server.config.origin:
            self.close_connection = True
            self._error(ApiError(403, "origin_denied", "POST requires the configured application Origin"))
            return
        if not self.server.config.ready:
            self.close_connection = True
            self._error(ApiError(503, "engine_unavailable", "Configure a multilingual whisper-cli model and binary"))
            return
        try:
            length = int(self.headers.get("Content-Length", ""))
            if length <= 0:
                raise ValueError("empty request")
        except ValueError:
            self.close_connection = True
            self._error(ApiError(411, "length_required", "Content-Length is required"))
            return
        if length > MAX_REQUEST_BYTES:
            self.close_connection = True
            self._error(ApiError(413, "request_too_large", "Request exceeds the 20 MB audio limit"))
            return
        if not self.server.job_lock.acquire(blocking=False):
            self.close_connection = True
            self._error(ApiError(429, "engine_busy", "Another transcription is in progress"))
            return
        try:
            self.connection.settimeout(30)
            payload = self.rfile.read(length)
            if len(payload) != length:
                raise ApiError(400, "incomplete_request", "Audio upload ended early")
            audio = parse_audio_multipart(self.headers.get("Content-Type", ""), payload)
            duration, silent = validate_wav(audio)
            if silent:
                result = {"api": API, "version": VERSION, "language": "it", "model": self.server.config.model_name, "segments": [], "text": ""}
            else:
                result = run_whisper(self.server.config, audio, duration, self.connection)
            self._json(200, result)
        except ApiError as exc:
            self._error(exc)
        except (TimeoutError, ConnectionError, OSError):
            self._error(ApiError(400, "incomplete_request", "Audio upload was interrupted"))
        finally:
            self.server.job_lock.release()


def main() -> None:
    parser = argparse.ArgumentParser(description="Local loopback whisper.cpp adapter for Diario di lavoro")
    parser.add_argument("--whisper-cli", type=Path, required=True, help="Absolute path to whisper-cli executable")
    parser.add_argument("--model", type=Path, required=True, help="Absolute path to a multilingual GGML model")
    parser.add_argument("--origin", default="http://127.0.0.1:4173", help="Exact allowed app origin")
    parser.add_argument("--host", default="127.0.0.1", help="Loopback listener: 127.0.0.1 or ::1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--path", default="/asr", help="Complete endpoint path")
    parser.add_argument("--timeout", type=int, default=900, help="whisper-cli job timeout in seconds")
    args = parser.parse_args()
    config = Config(args.whisper_cli.resolve(), args.model.resolve(), args.origin, args.host, args.port, args.path, args.timeout)
    try:
        with AsrServer(config) as server:
            display_host = f"[{config.host}]" if config.host == "::1" else config.host
            print(f"Diario local ASR listening on http://{display_host}:{config.port}{config.path}; ready={config.ready}", flush=True)
            server.serve_forever(poll_interval=0.2)
    except ValueError as exc:
        parser.error(str(exc))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
