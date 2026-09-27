import asyncio
import json
import re
import shutil
import sys
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "work-tools"
sys.path.insert(0, str(TOOLS))

import edge_tts
import lameenc
import miniaudio

BANK = ROOT / "data" / "exams" / "a1-complete" / "a1-sim-01.json"
OUTPUT = ROOT / "public" / "exam-media" / "a1-sim-01"
TEMP = ROOT / "tmp" / "a1-audio-segments"
SAMPLE_RATE = 24000
CHANNELS = 1
VOICES = {
    "Frau": "de-DE-KatjaNeural",
    "Mann": "de-DE-ConradNeural",
    "Ansage": "de-DE-AmalaNeural",
    "Narrator": "de-DE-SeraphinaMultilingualNeural",
}


def silence(seconds: float) -> array:
    return array("h", [0]) * int(SAMPLE_RATE * seconds * CHANNELS)


def decode_mp3(path: Path) -> array:
    decoded = miniaudio.decode_file(str(path), output_format=miniaudio.SampleFormat.SIGNED16,
                                    nchannels=CHANNELS, sample_rate=SAMPLE_RATE)
    return array("h", decoded.samples)


async def speak(text: str, voice: str, destination: Path) -> array:
    await edge_tts.Communicate(text, voice, rate="-8%", volume="+0%").save(str(destination))
    return decode_mp3(destination)


def dialogue_segments(script: str):
    pieces = re.split(r"(?=(?:Frau|Mann|Ansage):)", script)
    result = []
    for piece in pieces:
        piece = piece.strip(" ;")
        if not piece:
            continue
        match = re.match(r"(Frau|Mann|Ansage):\s*(.*)", piece)
        if match:
            result.append((match.group(1), match.group(2).strip()))
        else:
            result.append(("Narrator", piece))
    return result


def encode_mp3(samples: array, destination: Path):
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(96)
    encoder.set_in_sample_rate(SAMPLE_RATE)
    encoder.set_channels(CHANNELS)
    encoder.set_quality(2)
    payload = encoder.encode(samples.tobytes()) + encoder.flush()
    destination.write_bytes(payload)


async def main():
    bank = json.loads(BANK.read_text(encoding="utf-8"))
    exam = bank["exams"][0]
    questions = next(s for s in exam["sections"] if s["type"] == "hoeren")["questions"]
    shutil.rmtree(TEMP, ignore_errors=True)
    TEMP.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)

    for part in (1, 2, 3):
        items = [q for q in questions if q["part"] == part]
        track = array("h")
        intro = (
            f"Hören, Teil {part}. "
            + ("Was ist richtig? Wählen Sie A, B oder C. Sie hören jeden Text zweimal."
               if part != 2 else
               "Kreuzen Sie an: richtig oder falsch. Sie hören jeden Text einmal.")
        )
        track.extend(await speak(intro, VOICES["Narrator"], TEMP / f"p{part}-intro.mp3"))
        track.extend(silence(2.5))
        for q in items:
            number = q["order"]
            track.extend(await speak(f"Nummer {number}.", VOICES["Narrator"], TEMP / f"q{number}-number.mp3"))
            track.extend(silence(1.0))
            dialogue = array("h")
            for idx, (speaker, text) in enumerate(dialogue_segments(q["audio_script"])):
                dialogue.extend(await speak(text, VOICES[speaker], TEMP / f"q{number}-{idx}.mp3"))
                dialogue.extend(silence(0.35))
            track.extend(dialogue)
            track.extend(silence(3.5))
            if q.get("playback_count") == 2:
                track.extend(dialogue)
                track.extend(silence(5.5))
            else:
                track.extend(silence(2.0))
        track.extend(await speak(f"Ende von Teil {part}.", VOICES["Narrator"], TEMP / f"p{part}-end.mp3"))
        path = OUTPUT / f"hoeren-teil-{part}.mp3"
        encode_mp3(track, path)
        seconds = len(track) / SAMPLE_RATE / CHANNELS
        print(f"Wrote {path.relative_to(ROOT)} — {seconds:.1f}s — {path.stat().st_size / 1024:.1f} KiB")

    shutil.rmtree(TEMP, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())

