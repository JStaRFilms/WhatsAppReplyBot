from pathlib import Path
import json
from collections import deque
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent
options = json.loads((root / 'options.json').read_text(encoding='utf-8'))['options']
canvas = Image.new('RGB', (1440, 1840), 'white')
draw = ImageDraw.Draw(canvas)
regular = 'C:/Windows/Fonts/segoeui.ttf'
bold = 'C:/Windows/Fonts/seguisb.ttf'
emoji = 'C:/Windows/Fonts/seguiemj.ttf'
font_title = ImageFont.truetype(bold, 64)
font_name = ImageFont.truetype(bold, 44)
font_body = ImageFont.truetype(regular, 36)
font_sub = ImageFont.truetype(regular, 32)
font_small = ImageFont.truetype(regular, 28)
font_emoji = ImageFont.truetype(emoji, 122)
ink, muted = '#18212b', '#586473'
draw.text((80, 64), 'Help pick the Otherme logo', font=font_title, fill=ink)
draw.text((84, 159), 'Which one would you put on your phone?', font=font_sub, fill=muted)

specs = [
    ('A', 'Paired O', 'Two halves forming one O: you and your AI, working as one.', '\U0001f499', (211, 151, 1045, 980)),
    ('B', 'Conversation ribbon', 'A folded ribbon for the flow of back-and-forth conversation.', '\U0001f9e1', (161, 96, 1094, 1013)),
    ('C', 'Shared stroke', 'Two arches sharing a stem: two voices, one shared identity.', '\U0001f49b', (191, 154, 1065, 1000)),
]

def wrapped(text, width):
    lines, line = [], ''
    for word in text.split():
        candidate = (line + ' ' + word).strip()
        if draw.textlength(candidate, font=font_body) > width and line:
            lines.append(line)
            line = word
        else:
            line = candidate
    return lines + [line]

for index, (letter, name, meaning, vote, crop) in enumerate(specs):
    top = 280 + index * 490
    original = Image.open(options[index]['imagePath']).convert('RGBA')
    icon = original.crop(crop)
    if letter == 'C':
        # Remove only the ivory backdrop connected to the outside. The cream
        # stroke inside the navy tile stays intact.
        pixels = icon.load()
        edge = deque([(x, 0) for x in range(icon.width)] + [(x, icon.height - 1) for x in range(icon.width)] + [(0, y) for y in range(icon.height)] + [(icon.width - 1, y) for y in range(icon.height)])
        while edge:
            x, y = edge.popleft()
            if not (0 <= x < icon.width and 0 <= y < icon.height):
                continue
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0 or red < 225 or green < 215 or blue < 190:
                continue
            pixels[x, y] = (red, green, blue, 0)
            edge.extend(((x-1, y), (x+1, y), (x, y-1), (x, y+1)))
    icon.thumbnail((382, 382), Image.Resampling.LANCZOS)
    left, upper = 80 + (400 - icon.width) // 2, top + (400 - icon.height) // 2
    canvas.paste(icon, (left, upper), icon)
    draw.text((540, top + 62), letter + '  ' + name, font=font_name, fill=ink)
    y = top + 142
    for line in wrapped(meaning, 580):
        draw.text((540, y), line, font=font_body, fill=muted)
        y += 51
    bounds = draw.textbbox((0, 0), vote, font=font_emoji, embedded_color=True)
    width, height = bounds[2] - bounds[0], bounds[3] - bounds[1]
    draw.text((1280 - width / 2 - bounds[0], top + 152 - bounds[1]), vote, font=font_emoji, embedded_color=True)
    caption = 'Vote ' + letter
    caption_width = draw.textlength(caption, font=font_small)
    draw.text((1280 - caption_width / 2, top + 290), caption, font=font_small, fill=muted)
    if index < 2:
        draw.line((80, top + 443, 1360, top + 443), fill='#e7ebef', width=2)

footer = 'Vote with the matching heart in WhatsApp.'
w = draw.textlength(footer, font=font_sub)
draw.text(((1440 - w) / 2, 1760), footer, font=font_sub, fill=ink)
output = root / 'otherme-logo-vote.png'
canvas.save(output, optimize=True)
print(json.dumps({'path':str(output), 'width':canvas.width, 'height':canvas.height, 'mode':canvas.mode, 'bytes':output.stat().st_size}))
