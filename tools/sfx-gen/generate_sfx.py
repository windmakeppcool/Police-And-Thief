"""警察抓小偷：程序化生成短音效（WAV）。

仅依赖 Python 标准库（wave/math/struct/random/os），无第三方依赖，
可重复运行且输出确定：噪声使用固定随机种子，所有音效整体峰值归一化到约 -3dB（0.707）。
产物直接落到 assets/Game/Res/Audio/，由 Cocos Creator 刷新导入为 AudioClip。

用法：
    python tools/sfx-gen/generate_sfx.py
"""

import math
import os
import random
import struct
import wave

# 音频参数：44100Hz、16bit、单声道 PCM
SAMPLE_RATE = 44100
SAMPLE_WIDTH = 2
CHANNELS = 1
# 整体峰值约 -3dB
PEAK = 0.707
# 噪声固定种子，保证重复运行结果一致
NOISE_SEED = 20260517
TAU = math.tau

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       '..', '..', 'assets', 'Game', 'Res', 'Audio')


def gen_place():
    """落子确认：短促“嗒”，约 0.09s，380Hz 正弦快速指数衰减，
    叠加 1200Hz 极短高频起音（前 0.01s）。"""
    duration = 0.09
    n = int(SAMPLE_RATE * duration)
    noise = random.Random(NOISE_SEED)
    buf = [0.0] * n
    for i in range(n):
        t = i / SAMPLE_RATE
        # 指数衰减包络，落子干脆不拖尾
        env = math.exp(-34 * t)
        sample = math.sin(TAU * 380 * t) * env
        # 前 0.01s 的高频起音，让“嗒”更有颗粒感
        if t < 0.01:
            sample += 0.35 * math.sin(TAU * 1200 * t) * math.exp(-160 * t)
        # 极少量噪声增加敲击质感
        sample += 0.04 * (noise.random() * 2 - 1) * env
        buf[i] = sample
    return buf


def gen_rotate():
    """转向：520→780Hz 两个上行短音，各约 0.05s，间隔 0.02s。"""
    beep = 0.05
    gap = 0.02
    n = int(SAMPLE_RATE * (beep * 2 + gap))
    buf = [0.0] * n
    for seg, freq in enumerate((520.0, 780.0)):
        start = int(seg * (beep + gap) * SAMPLE_RATE)
        for i in range(int(beep * SAMPLE_RATE)):
            t = i / SAMPLE_RATE
            env = math.exp(-18 * t)
            buf[start + i] += math.sin(TAU * freq * t) * env
    return buf


def gen_remove():
    """收回：柔和“噗”，约 0.09s，300Hz 正弦 + 少量衰减噪声，音量略低于 place。"""
    duration = 0.09
    n = int(SAMPLE_RATE * duration)
    noise = random.Random(NOISE_SEED + 1)
    buf = [0.0] * n
    for i in range(n):
        t = i / SAMPLE_RATE
        # 稍慢的指数衰减，听感更柔和
        env = math.exp(-24 * t)
        sample = math.sin(TAU * 300 * t) * env
        sample += 0.08 * (noise.random() * 2 - 1) * env
        buf[i] = 0.82 * sample
    return buf


def gen_invalid():
    """非法落点：约 0.16s 低频提示，170Hz 方波/正弦混合，频率 ±15Hz 摆动两次。"""
    duration = 0.16
    n = int(SAMPLE_RATE * duration)
    buf = [0.0] * n
    for i in range(n):
        t = i / SAMPLE_RATE
        # 两次完整摆动（每 0.08s 一次）；对瞬时频率做相位积分，避免相位跳变
        wobble_rate = 2 / duration
        phase = TAU * 170.0 * t - (15.0 / wobble_rate) * math.cos(TAU * wobble_rate * t)
        sine = math.sin(phase)
        # 窄占空比方波（符号函数）与正弦混合，低频有“嘟”感又不刺耳
        square = 1.0 if math.sin(phase) >= 0 else -1.0
        env = min(1.0, t / 0.01) * math.exp(-7 * t)
        buf[i] = 0.65 * (0.6 * sine + 0.4 * square) * env
    return buf


def gen_undo():
    """撤销：约 0.12s 下行滑音 520→300Hz，正弦。"""
    duration = 0.12
    n = int(SAMPLE_RATE * duration)
    buf = [0.0] * n
    f0, f1 = 520.0, 300.0
    phase = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        p = t / duration
        # 指数下滑更接近自然“回落”听感
        freq = f0 * ((f1 / f0) ** p)
        env = math.exp(-10 * t)
        buf[i] = math.sin(phase) * env
        # 相位按瞬时频率积分，保证滑音连续
        phase += TAU * freq / SAMPLE_RATE
    return buf


def gen_win():
    """胜利：约 0.6s 上行琶音 C5-E5-G5-C6（523/659/784/1047Hz），
    前三个各 0.12s，最后一个 0.24s，正弦 + 轻微二次谐波，结尾淡出。"""
    notes = [(523.25, 0.12), (659.25, 0.12), (783.99, 0.12), (1046.5, 0.24)]
    n = int(SAMPLE_RATE * sum(d for _, d in notes))
    buf = [0.0] * n
    pos = 0
    for idx, (freq, dur) in enumerate(notes):
        count = int(SAMPLE_RATE * dur)
        for i in range(count):
            t = i / SAMPLE_RATE
            env = math.exp(-4.5 * t)
            sample = math.sin(TAU * freq * t) + 0.18 * math.sin(TAU * 2 * freq * t)
            # 最后一个音结尾 0.08s 淡出
            if idx == len(notes) - 1 and t > dur - 0.08:
                env *= max(0.0, (dur - t) / 0.08)
            buf[pos + i] = sample * env
        pos += count
    return buf


def gen_button():
    """按钮点击：约 0.06s 清脆短音，720Hz 指数衰减，起音 2ms。"""
    duration = 0.06
    n = int(SAMPLE_RATE * duration)
    buf = [0.0] * n
    for i in range(n):
        t = i / SAMPLE_RATE
        # 2ms 淡入起音，避免咔哒声
        attack = min(1.0, t / 0.002)
        env = attack * math.exp(-42 * t)
        buf[i] = math.sin(TAU * 720 * t) * env
    return buf


SOUNDS = [
    ('sfx_place.wav', gen_place),
    ('sfx_rotate.wav', gen_rotate),
    ('sfx_remove.wav', gen_remove),
    ('sfx_invalid.wav', gen_invalid),
    ('sfx_undo.wav', gen_undo),
    ('sfx_win.wav', gen_win),
    ('sfx_button.wav', gen_button),
]


def normalize_all(buffers):
    """按全部音效的最大峰值统一归一化到约 -3dB，保持音效间相对响度。"""
    peak = 0.0
    for buf in buffers:
        for sample in buf:
            level = abs(sample)
            if level > peak:
                peak = level
    if peak <= 0.0:
        return buffers
    scale = PEAK / peak
    return [[sample * scale for sample in buf] for buf in buffers]


def write_wav(path, buf):
    """把浮点采样（-1..1）写成 16bit 单声道 PCM WAV。"""
    frames = bytearray()
    for sample in buf:
        clamped = max(-1.0, min(1.0, sample))
        frames.extend(struct.pack('<h', int(clamped * 32767)))
    with wave.open(path, 'wb') as wav:
        wav.setnchannels(CHANNELS)
        wav.setsampwidth(SAMPLE_WIDTH)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(bytes(frames))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    buffers = [factory() for _, factory in SOUNDS]
    buffers = normalize_all(buffers)
    for (name, _), buf in zip(SOUNDS, buffers):
        path = os.path.normpath(os.path.join(OUT_DIR, name))
        write_wav(path, buf)
        print('生成: {} ({} 采样, {:.3f}s)'.format(path, len(buf), len(buf) / SAMPLE_RATE))


if __name__ == '__main__':
    main()
