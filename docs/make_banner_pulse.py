from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1600, 900
root = r"C:\Users\zy134\Desktop\dsh-claudelike"
out = os.path.join(root, "docs", "banner-pulse.png")

# background gradient
bg = Image.new("RGB", (W, H), (17, 17, 20))
top = (24, 24, 28)
bottom = (12, 12, 15)
for y in range(H):
    t = y / H
    r = int(top[0] * (1 - t) + bottom[0] * t)
    g = int(top[1] * (1 - t) + bottom[1] * t)
    b = int(top[2] * (1 - t) + bottom[2] * t)
    ImageDraw.Draw(bg).line([(0, y), (W, y)], fill=(r, g, b))

draw = ImageDraw.Draw(bg, "RGBA")
# soft glows
for cx, cy, rad, col in [(1250, 250, 380, (91, 141, 239, 40)), (300, 720, 420, (226, 163, 60, 26)), (900, 850, 300, (63, 191, 127, 20))]:
    for i in range(rad, 0, -8):
        a = int(col[3] * (1 - i / rad) ** 2)
        draw.ellipse([cx - i, cy - i, cx + i, cy + i], fill=(col[0], col[1], col[2], a))

font_dir = r"C:\Windows\Fonts"
def font(name, size):
    try:
        return ImageFont.truetype(os.path.join(font_dir, name), size)
    except Exception:
        return ImageFont.load_default()

f_title = font("msyhbd.ttc", 118)
f_sub = font("msyh.ttc", 34)
f_small = font("msyh.ttc", 24)
f_tag = font("msyhbd.ttc", 22)

draw.text((90, 150), "Pulse", font=f_title, fill=(245, 245, 250))
# accent underline
draw.rounded_rectangle([96, 300, 96 + 420, 310], radius=5, fill=(91, 141, 239, 235))

lines = [
    "为 DeepSeek Harness 侧边栏",
    "注入 Claude 的状态流。",
]
y = 340
for line in lines:
    draw.text((96, y), line, font=f_sub, fill=(196, 198, 208))
    y += 56

bullets = [
    ("状态总表", "需要输入 / 正在工作 / 未读 / 已完成"),
    ("项目分栏", "状态 → 项目 → 会话 → 执行步骤"),
    ("实时步骤", "todo 投影 + 运行中转圈，白色高光扫过"),
    ("丝滑转场", "FLIP 240ms，流式更新不闪"),
]
y = 480
for i, (tag, text) in enumerate(bullets):
    draw.rounded_rectangle([96, y, 96 + 108, y + 34], radius=8, fill=(255, 255, 255, 14))
    draw.text((110, y + 5), tag, font=f_tag, fill=(140, 175, 245))
    draw.text((218, y + 3), text, font=f_small, fill=(160, 163, 172))
    y += 52

draw.text((96, 780), "dsh plugin · MIT · no dependencies", font=f_small, fill=(110, 112, 122))

# screenshot card on the right
shot = Image.open(os.path.join(root, "docs", "screenshots", "status-table.png")).convert("RGB")
scale = 1.18
shot = shot.resize((int(shot.width * scale), int(shot.height * scale)), Image.LANCZOS)
card_x, card_y = 980, 120
pad = 14
card = Image.new("RGB", (shot.width + pad * 2, shot.height + pad * 2), (32, 32, 38))
mask = Image.new("L", card.size, 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, card.width - 1, card.height - 1], radius=22, fill=255)
bg.paste(card, (card_x, card_y), mask)
shot_mask = Image.new("L", shot.size, 0)
ImageDraw.Draw(shot_mask).rounded_rectangle([0, 0, shot.width - 1, shot.height - 1], radius=14, fill=255)
bg.paste(shot, (card_x + pad, card_y + pad), shot_mask)

bg.save(out, "PNG")
print("wrote", out, bg.size)
