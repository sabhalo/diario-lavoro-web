"""Run with: python -m unittest discover -s local-asr -p 'test_*.py'."""

import http.client
import io
import json
import socket
import tempfile
import threading
import unittest
import wave
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

from server import API, ApiError, AsrServer, Config, normalize_output, validate_wav


ORIGIN = "http://127.0.0.1:4173"


def wav_bytes(seconds=0.1, sample=0):
    stream = io.BytesIO()
    with wave.open(stream, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(sample.to_bytes(2, "little", signed=True) * int(16000 * seconds))
    return stream.getvalue()


def multipart(audio, language=b"it"):
    boundary = b"diario-test-boundary"
    body = (
        b"--" + boundary + b"\r\n"
        b'Content-Disposition: form-data; name="language"\r\n\r\n'
        + language + b"\r\n"
        + b"--" + boundary + b"\r\n"
        + b'Content-Disposition: form-data; name="audio"; filename="audio.wav"\r\n'
        + b"Content-Type: audio/wav\r\n\r\n"
        + audio + b"\r\n--" + boundary + b"--\r\n"
    )
    return body, "multipart/form-data; boundary=diario-test-boundary"


class HelperApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        directory = Path(self.temp.name)
        cli = directory / "whisper-cli.exe"
        model = directory / "ggml-small.bin"
        cli.write_bytes(b"fake")
        model.write_bytes(b"fake")
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            port = probe.getsockname()[1]
        self.server = AsrServer(Config(cli, model, ORIGIN, port=port))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temp.cleanup()

    def request(self, method="GET", path="/asr", body=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)
        try:
            connection.request(method, path, body=body, headers=headers or {})
            response = connection.getresponse()
            raw = response.read()
            return response.status, dict(response.getheaders()), json.loads(raw) if raw else None
        finally:
            connection.close()

    def test_health_and_cors_preflight(self):
        status, headers, data = self.request(headers={"Origin": ORIGIN})
        self.assertEqual(status, 200)
        self.assertEqual(data["api"], API)
        self.assertTrue(data["ready"])
        self.assertEqual(data["language"], "it")
        self.assertEqual(headers["Access-Control-Allow-Origin"], ORIGIN)
        status, headers, _ = self.request("OPTIONS", headers={
            "Origin": ORIGIN, "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        })
        self.assertEqual(status, 204)
        self.assertEqual(headers["Access-Control-Allow-Origin"], ORIGIN)

    def test_startup_does_not_reverse_resolve_loopback(self):
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            port = probe.getsockname()[1]
        config = replace(self.server.config, port=port)
        with patch("socket.getfqdn", side_effect=AssertionError("reverse DNS must not run")) as resolver:
            with AsrServer(config) as server:
                self.assertEqual(server.server_name, "127.0.0.1")
                self.assertEqual(server.server_port, port)
        resolver.assert_not_called()

    def test_rejects_other_origin_and_path(self):
        status, headers, data = self.request(headers={"Origin": "https://attacker.example"})
        self.assertEqual(status, 403)
        self.assertNotIn("Access-Control-Allow-Origin", headers)
        self.assertEqual(data["error"]["code"], "origin_denied")
        status, _, _ = self.request(path="/asr/extra")
        self.assertEqual(status, 404)
        status, _, data = self.request(headers={"Host": "attacker.example"})
        self.assertEqual(status, 400)
        self.assertEqual(data["error"]["code"], "invalid_host")

    def test_post_audio_only_with_timed_response(self):
        body, content_type = multipart(wav_bytes(sample=1))
        expected = {"api": API, "version": 1, "language": "it", "model": "ggml-small.bin",
                    "segments": [{"start": 0, "end": 0.1, "text": "Ciao"}], "text": "Ciao"}
        with patch("server.run_whisper", return_value=expected) as runner:
            status, headers, data = self.request("POST", body=body, headers={"Origin": ORIGIN, "Content-Type": content_type})
        self.assertEqual(status, 200)
        self.assertEqual(data, expected)
        self.assertEqual(headers["Access-Control-Allow-Origin"], ORIGIN)
        self.assertEqual(runner.call_args.args[1][:4], b"RIFF")
        self.assertAlmostEqual(runner.call_args.args[2], 0.1)

    def test_digitally_silent_wav_does_not_invoke_whisper(self):
        body, content_type = multipart(wav_bytes(seconds=1))
        with patch("server.run_whisper", side_effect=ApiError(502, "invalid_engine_output", "whisper-cli returned invalid segment timing")) as runner:
            status, _, data = self.request("POST", body=body, headers={"Origin": ORIGIN, "Content-Type": content_type})
        self.assertEqual(status, 200)
        self.assertEqual(data["segments"], [])
        self.assertEqual(data["text"], "")
        runner.assert_not_called()

    def test_rejects_video_and_non_italian(self):
        body, content_type = multipart(b"\x1a\x45\xdf\xa3WebM")
        status, _, data = self.request("POST", body=body, headers={"Origin": ORIGIN, "Content-Type": content_type})
        self.assertEqual(status, 415)
        self.assertEqual(data["error"]["code"], "unsupported_audio")
        body, content_type = multipart(wav_bytes(), b"en")
        status, _, data = self.request("POST", body=body, headers={"Origin": ORIGIN, "Content-Type": content_type})
        self.assertEqual(status, 422)
        self.assertEqual(data["error"]["code"], "unsupported_language")

    def test_post_requires_configured_origin(self):
        body, content_type = multipart(wav_bytes())
        status, _, data = self.request("POST", body=body, headers={"Content-Type": content_type})
        self.assertEqual(status, 403)
        self.assertEqual(data["error"]["code"], "origin_denied")

    def test_normalizes_millisecond_offsets(self):
        response = normalize_output({"result": {"language": "it"}, "transcription": [
            {"offsets": {"from": 250, "to": 1700}, "text": " Ciao a tutti "},
            {"offsets": {"from": 1800, "to": 2500}, "text": " oggi "},
        ]}, 3, "ggml-small.bin")
        self.assertEqual(response["segments"], [
            {"start": 0.25, "end": 1.7, "text": "Ciao a tutti"},
            {"start": 1.8, "end": 2.5, "text": "oggi"},
        ])
        self.assertEqual(response["text"], "Ciao a tutti oggi")
        with self.assertRaises(ApiError) as error:
            normalize_output({"transcription": [{"offsets": {"from": 0, "to": 5000}, "text": "wrong"}]}, 1, "ggml-small.bin")
        self.assertEqual(error.exception.code, "untrusted_timing")

    def test_audio_limit(self):
        with patch("server.MAX_DURATION_SECONDS", 0.05):
            with self.assertRaises(ApiError) as error:
                validate_wav(wav_bytes(0.1))
        self.assertEqual(error.exception.code, "duration_limit")
        with self.assertRaises(ApiError) as error:
            validate_wav(wav_bytes(0.1)[:-10])
        self.assertEqual(error.exception.code, "truncated_audio")


if __name__ == "__main__":
    unittest.main()
