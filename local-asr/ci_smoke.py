"""Real whisper.cpp loopback smoke for the pinned harmless Italian fixture.

The CI workflow builds/downloads/verifies engine and model before calling this
script. This script starts and always stops the helper itself.
"""

from __future__ import annotations

import argparse
import hashlib
import http.client
import json
import math
import socket
import subprocess
import sys
import tempfile
import time
import uuid
import wave
from pathlib import Path


FIXTURE_SHA256 = "6a68e0c1981ff3bee35b813ea1903c8c476027e46c0c3fc90ee545a82a52a5e4"
EXPECTED_TEXT = "Aspettiamo un po', perché a volte ci vuole un po' di tempo."
ORIGIN = "http://127.0.0.1:4173"


def request(port: int, method: str, body: bytes | None = None, content_type: str | None = None) -> tuple[int, dict]:
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=950 if method == "POST" else 5)
    headers = {"Origin": ORIGIN}
    if content_type:
        headers["Content-Type"] = content_type
    try:
        connection.request(method, "/asr", body=body, headers=headers)
        response = connection.getresponse()
        payload = response.read(1_000_001)
        if len(payload) > 1_000_000:
            raise AssertionError("Helper response exceeds 1 MB")
        return response.status, json.loads(payload)
    finally:
        connection.close()


def multipart(audio: bytes) -> tuple[bytes, str]:
    boundary = f"diario-ci-{uuid.uuid4().hex}"
    marker = boundary.encode("ascii")
    body = (
        b"--" + marker + b"\r\n"
        b'Content-Disposition: form-data; name="language"\r\n\r\nit\r\n'
        + b"--" + marker + b"\r\n"
        + b'Content-Disposition: form-data; name="audio"; filename="italiano.wav"\r\n'
        + b"Content-Type: audio/wav\r\n\r\n"
        + audio + b"\r\n--" + marker + b"--\r\n"
    )
    return body, f"multipart/form-data; boundary={boundary}"


def check_result(result: dict, duration: float) -> None:
    assert result["api"] == "diario-local-asr" and result["version"] == 1, result
    assert result["language"] == "it", result
    assert result["model"] == "ggml-large-v3-turbo-q5_0.bin", result
    assert result["text"] == EXPECTED_TEXT, result
    segments = result["segments"]
    assert isinstance(segments, list) and segments, result
    previous_start = 0.0
    for segment in segments:
        start, end = segment["start"], segment["end"]
        assert isinstance(start, (int, float)) and isinstance(end, (int, float)), result
        assert math.isfinite(start) and math.isfinite(end), result
        assert 0 <= previous_start <= start < end <= duration, result
        assert isinstance(segment["text"], str) and segment["text"].strip(), result
        previous_start = start
    assert segments[0]["start"] <= 0.5 and segments[-1]["end"] >= 1.5, result
    assert " ".join(segment["text"] for segment in segments) == EXPECTED_TEXT, result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--whisper-cli", type=Path, required=True)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--audio", type=Path, required=True)
    args = parser.parse_args()

    audio = args.audio.read_bytes()
    if hashlib.sha256(audio).hexdigest() != FIXTURE_SHA256:
        raise AssertionError("Italian fixture SHA-256 differs from the pinned file")
    with wave.open(str(args.audio), "rb") as wav:
        duration = wav.getnframes() / wav.getframerate()
        assert (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) == (1, 2, 16000)

    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix="diario-local-asr-ci-") as directory:
        log_path = Path(directory) / "helper.log"
        with log_path.open("w", encoding="utf-8") as log:
            process = subprocess.Popen(
                [sys.executable, str(Path(__file__).with_name("server.py")),
                 "--whisper-cli", str(args.whisper_cli.resolve()),
                 "--model", str(args.model.resolve()),
                 "--origin", ORIGIN, "--port", str(port)],
                stdout=log, stderr=subprocess.STDOUT,
            )
            try:
                deadline = time.monotonic() + 30
                while True:
                    if process.poll() is not None:
                        raise AssertionError(f"Helper exited during startup: {process.returncode}")
                    try:
                        status, health = request(port, "GET")
                        break
                    except (ConnectionError, TimeoutError, OSError):
                        if time.monotonic() >= deadline:
                            raise AssertionError("Helper did not accept loopback connections within 30 seconds")
                        time.sleep(0.2)
                assert status == 200 and health["api"] == "diario-local-asr", health
                assert health["version"] == 1 and health["ready"] is True, health
                assert health["language"] == "it" and health["timestamps"] is True, health
                assert health["model"] == "ggml-large-v3-turbo-q5_0.bin", health
                assert len(audio) <= health["maxAudioBytes"] and duration <= health["maxDurationSeconds"], health
                body, content_type = multipart(audio)
                started = time.monotonic()
                status, result = request(port, "POST", body, content_type)
                elapsed = time.monotonic() - started
                if status != 200:
                    raise AssertionError(f"POST returned {status}: {result}")
                check_result(result, duration)
                print(f"Mac local-helper smoke passed: {duration:.2f}s Italian WAV, exact text, {len(result['segments'])} timed segment(s), HTTP POST {elapsed:.2f}s")
            except Exception:
                log.flush()
                print("Helper log:\n" + log_path.read_text(encoding="utf-8")[-4000:], file=sys.stderr)
                raise
            finally:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()


if __name__ == "__main__":
    main()
