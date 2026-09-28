import asyncio
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

OUTPUT = ROOT / "public" / "exam-media" / "ga-a1-m01"
TEMP = ROOT / "tmp" / "ga-a1-m01-audio"
SAMPLE_RATE = 24000
CHANNELS = 1

# Original German Academy dialogue (not from commercial packs).
SCRIPT = [
    ("Ansage", "Hören Sie den Dialog."),
    ("Mann", "Guten Tag! Ich heiße Karim. Ich komme aus Algerien und wohne in Lyon."),
    ("Frau", "Schön! Ich heiße Nora. Ich spreche Deutsch und Französisch."),
]

VOICES = {
    "Frau": "de-DE-KatjaNeural",
    "Mann": "de-DE-ConradNeural",
    "Ansage": "de-DE-AmalaNeural",
}


def silence(seconds: float) -> array:
    return array("h", [0]) * int(SAMPLE_RATE * seconds * CHANNELS)


def decode_mp3(path: Path) -> array:
    decoded = miniaudio.decode_file(
        str(path),
        output_format=miniaudio.SampleFormat.SIGNED16,
        nchannels=CHANNELS,
        sample_rate=SAMPLE_RATE,
    )
    return array("h", decoded.samples)


async def speak(text: str, voice: str, destination: Path) -> array:
    await edge_tts.Communicate(text, voice, rate="-8%", volume="+0%").save(str(destination))
    return decode_mp3(destination)


def encode_mp3(samples: array, destination: Path):
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(96)
    encoder.set_in_sample_rate(SAMPLE_RATE)
    encoder.set_channels(CHANNELS)
    encoder.set_quality(2)
    payload = encoder.encode(samples.tobytes()) + encoder.flush()
    destination.write_bytes(payload)


async def main():
    shutil.rmtree(TEMP, ignore_errors=True)
    TEMP.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)

    track = array("h")
    track.extend(silence(0.4))
    for idx, (speaker, text) in enumerate(SCRIPT):
        part_path = TEMP / f"seg-{idx:02d}.mp3"
        samples = await speak(text, VOICES[speaker], part_path)
        track.extend(samples)
        track.extend(silence(0.45))

    out = OUTPUT / "hoeren-vorstellen.mp3"
    encode_mp3(track, out)
    duration = len(track) / SAMPLE_RATE / CHANNELS
    print(f"OK {out} duration_s={duration:.1f}")


if __name__ == "__main__":
    asyncio.run(main())
