from pathlib import Path
import xml.etree.ElementTree as ET

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing, Group
from reportlab.graphics.svgpath import SvgPath
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(r"C:\Users\Shina\codynego\neba")
OUT = ROOT / "output" / "pdf" / "getneba-print-flyer.pdf"
LOGO = ROOT / "frontend" / "public" / "brand" / "getneba-wordmark.svg"

GREEN = HexColor("#087F5B")
DARK = HexColor("#0B3B2E")
INK = HexColor("#111820")
CREAM = HexColor("#F8FAF8")
MINT = HexColor("#D7F6EB")
SAGE = HexColor("#A7C2B8")
YELLOW = HexColor("#F2C14E")


pdfmetrics.registerFont(TTFont("GetNeba", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("GetNeba-Bold", r"C:\Windows\Fonts\arialbd.ttf"))


def rounded(c, x, y, w, h, radius, fill, stroke=None, line_width=1):
    c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke)
        c.setLineWidth(line_width)
        c.roundRect(x, y, w, h, radius, fill=1, stroke=1)
    else:
        c.roundRect(x, y, w, h, radius, fill=1, stroke=0)


def draw_logo(c, path, x, y, width):
    tree = ET.parse(path)
    root = tree.getroot()
    min_x, min_y, vb_w, vb_h = map(float, root.attrib["viewBox"].split())
    scale = width / vb_w
    height = vb_h * scale
    drawing = Drawing(width, height)
    group = Group()
    # SVG uses a top-left origin while PDF uses a bottom-left origin.
    group.transform = (
        scale,
        0,
        0,
        -scale,
        -min_x * scale,
        (min_y + vb_h) * scale,
    )
    for element in root.iter():
        if element.tag.endswith("path") and element.attrib.get("d"):
            fill = element.attrib.get("fill", "#000000")
            if fill.startswith("rgb("):
                channels = [int(v.strip()) for v in fill[4:-1].split(",")]
                fill = "#" + "".join(f"{v:02x}" for v in channels)
            group.add(SvgPath(element.attrib["d"], fillColor=HexColor(fill), strokeColor=None))
    drawing.add(group)
    renderPDF.draw(drawing, c, x, y)
    return height


def paragraph(c, html, x, y_top, width, size, leading, color, font="GetNeba", align=0):
    style = ParagraphStyle(
        "flyer",
        fontName=font,
        fontSize=size,
        leading=leading,
        textColor=color,
        alignment=align,
        spaceAfter=0,
        spaceBefore=0,
    )
    p = Paragraph(html, style)
    _, h = p.wrap(width, 1000)
    p.drawOn(c, x, y_top - h)
    return h


def draw_person(c, cx, cy, scale=1.0, fill=CREAM, accent=YELLOW):
    c.setFillColor(fill)
    c.circle(cx, cy + 20 * scale, 12 * scale, fill=1, stroke=0)
    c.roundRect(cx - 22 * scale, cy - 20 * scale, 44 * scale, 31 * scale, 13 * scale, fill=1, stroke=0)
    c.setFillColor(accent)
    c.circle(cx + 16 * scale, cy + 29 * scale, 4 * scale, fill=1, stroke=0)


def draw_pin(c, x, y, scale=1.0, fill=YELLOW):
    c.setFillColor(fill)
    p = c.beginPath()
    p.moveTo(x, y)
    p.curveTo(x - 20 * scale, y + 28 * scale, x - 19 * scale, y + 48 * scale, x, y + 48 * scale)
    p.curveTo(x + 19 * scale, y + 48 * scale, x + 20 * scale, y + 28 * scale, x, y)
    c.drawPath(p, fill=1, stroke=0)
    c.setFillColor(DARK)
    c.circle(x, y + 31 * scale, 7 * scale, fill=1, stroke=0)


def draw_qr(c, value, x, y, size):
    qr = QrCodeWidget(value)
    x1, y1, x2, y2 = qr.getBounds()
    scale_x = size / (x2 - x1)
    scale_y = size / (y2 - y1)
    drawing = Drawing(size, size, transform=[scale_x, 0, 0, scale_y, 0, 0])
    drawing.add(qr)
    renderPDF.draw(drawing, c, x, y)


def build():
    width, height = A4
    c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
    c.setTitle("GetNeba print flyer")
    c.setAuthor("GetNeba")
    c.setSubject("Promotional A4 flyer")

    # Background and main brand field.
    c.setFillColor(CREAM)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    c.setFillColor(DARK)
    c.rect(0, 310, width, height - 310, fill=1, stroke=0)

    # Branded header capsule with the official vector wordmark.
    rounded(c, 34, 772, 174, 45, 22, CREAM)
    draw_logo(c, LOGO, 50, 781, 142)

    # Upper-right utility label.
    rounded(c, 400, 781, 161, 28, 14, GREEN)
    c.setFont("GetNeba-Bold", 9)
    c.setFillColor(white)
    c.drawCentredString(480.5, 790, "LOCAL HELP. REAL PEOPLE.")

    # Headline.
    c.setFillColor(white)
    c.setFont("GetNeba-Bold", 45)
    c.drawString(38, 704, "Good help")
    c.setFillColor(YELLOW)
    c.drawString(38, 653, "is closer")
    c.setFillColor(white)
    c.drawString(38, 602, "than you think.")

    paragraph(
        c,
        "Find people nearby for everyday tasks - or earn by sharing the skills you already have.",
        40,
        559,
        278,
        13.5,
        19,
        CREAM,
        "GetNeba",
    )

    # Community connection illustration.
    cx, cy = 452, 610
    c.setStrokeColor(GREEN)
    c.setLineWidth(1.3)
    for radius in (62, 91, 121):
        c.circle(cx, cy, radius, fill=0, stroke=1)
    c.setStrokeColor(SAGE)
    c.setDash(2, 4)
    c.circle(cx, cy, 76, fill=0, stroke=1)
    c.setDash()
    draw_person(c, cx, cy - 8, 1.25, CREAM, YELLOW)
    draw_person(c, 516, 682, 0.63, MINT, YELLOW)
    draw_person(c, 378, 680, 0.56, MINT, YELLOW)
    draw_person(c, 535, 551, 0.52, MINT, YELLOW)
    draw_pin(c, 369, 535, 0.72, YELLOW)

    # Message band.
    c.setFillColor(YELLOW)
    c.rect(0, 310, width, 40, fill=1, stroke=0)
    c.setFillColor(DARK)
    c.setFont("GetNeba-Bold", 10.5)
    c.drawCentredString(width / 2, 325, "REAL TASKS.  REAL PEOPLE.  RIGHT AROUND YOU.")

    # Two action cards.
    rounded(c, 34, 187, 252, 98, 18, white, SAGE, 0.8)
    rounded(c, 309, 187, 252, 98, 18, white, SAGE, 0.8)

    draw_pin(c, 67, 229, 0.42, GREEN)
    c.setFillColor(DARK)
    c.setFont("GetNeba-Bold", 15)
    c.drawString(94, 253, "NEED A HAND?")
    paragraph(c, "Post what you need and connect with people in your area.", 94, 237, 171, 9.8, 13.5, INK)

    draw_person(c, 342, 228, 0.44, GREEN, YELLOW)
    c.setFillColor(DARK)
    c.setFont("GetNeba-Bold", 15)
    c.drawString(370, 253, "READY TO HELP?")
    paragraph(c, "Create an offer, share your skills and find nearby work.", 370, 237, 171, 9.8, 13.5, INK)

    # Bottom call to action.
    rounded(c, 34, 32, 527, 126, 24, GREEN)
    c.setFillColor(white)
    c.setFont("GetNeba-Bold", 23)
    c.drawString(57, 119, "Find help. Offer a skill.")
    c.setFont("GetNeba", 11)
    c.drawString(58, 98, "Join your local community on GetNeba.")
    rounded(c, 56, 54, 245, 30, 15, DARK)
    c.setFillColor(white)
    c.setFont("GetNeba-Bold", 14)
    c.drawString(72, 64, "getneba.app")
    c.setFont("GetNeba", 8.5)
    c.drawRightString(294, 65, "SCAN TO START  ->")

    rounded(c, 436, 45, 105, 105, 16, white)
    draw_qr(c, "https://getneba.app", 447, 56, 83)

    # Printer-safe footer note.
    c.setFillColor(HexColor("#557168"))
    c.setFont("GetNeba", 6.8)
    c.drawCentredString(width / 2, 16, "GETNEBA.APP  |  FIND TASKS  |  FIND PEOPLE  |  POST A TASK")

    c.showPage()
    c.save()
    print(OUT)


if __name__ == "__main__":
    build()
