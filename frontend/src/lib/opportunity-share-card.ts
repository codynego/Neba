import { Opportunity } from "@/lib/types";

const COLORS = {
  forest: "#0b3b2c",
  green: "#087f5b",
  mint: "#ddf5ea",
  mist: "#eff8f2",
  paper: "#fbfcf9",
  ink: "#14251f",
  muted: "#627169",
  gold: "#f2c14e",
  line: "#d7e5dc",
};

const CATEGORY_LABELS: Record<string, string> = {
  scholarship: "Scholarship",
  grant: "Grant",
  job: "Job",
  internship: "Internship",
  fellowship: "Fellowship",
  competition: "Competition",
  training: "Training",
  startup: "Startup program",
  funding: "Business funding",
  tender: "Tender",
};

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, color: string) {
  context.fillStyle = color;
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function fitLines(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  const consumed = lines.join(" ").split(/\s+/).length;
  if (consumed < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trim()}…`;
  }
  return lines;
}

function drawLines(context: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) {
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function dateLabel(value: string | null) {
  if (!value) return "Open deadline";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function locationLabel(opportunity: Opportunity) {
  if (opportunity.is_remote && !opportunity.requires_physical_presence) return "Remote";
  return opportunity.location_label || opportunity.country || "Location varies";
}

function attendanceLabel(opportunity: Opportunity) {
  if (opportunity.requires_local_residency) return "Local residents";
  if (opportunity.requires_physical_presence && opportunity.is_remote) return "Hybrid";
  if (opportunity.requires_physical_presence) return "In person";
  if (opportunity.is_remote) return "Remote";
  return "See details";
}

function hostLabel(shareUrl: string) {
  try {
    return new URL(shareUrl).host.replace(/^www\./, "");
  } catch {
    return "getneba.app";
  }
}

export async function downloadOpportunityShareCard(opportunity: Opportunity, shareUrl: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image export is unavailable in this browser.");

  await document.fonts?.ready.catch(() => undefined);

  context.fillStyle = COLORS.mint;
  context.fillRect(0, 0, 1080, 1080);

  // The vertical pass spine makes the card recognizable in a crowded social feed.
  context.fillStyle = COLORS.forest;
  context.fillRect(0, 0, 112, 1080);
  context.save();
  context.translate(57, 875);
  context.rotate(-Math.PI / 2);
  context.fillStyle = "#b7e8ca";
  context.font = "800 20px Arial, sans-serif";
  context.fillText("GETNEBA  ·  OPPORTUNITY PASS  ·  SHARE WHAT OPENS A DOOR", 0, 0);
  context.restore();
  context.fillStyle = COLORS.gold;
  context.beginPath();
  context.arc(56, 68, 12, 0, Math.PI * 2);
  context.fill();

  roundedRect(context, 148, 42, 890, 996, 34, COLORS.paper);

  try {
    const logo = await loadImage("/brand/getneba-wordmark.svg");
    context.drawImage(logo, 194, 76, 214, 50);
  } catch {
    context.fillStyle = COLORS.green;
    context.font = "800 33px Arial, sans-serif";
    context.fillText("GETNEBA", 194, 116);
  }

  const trustLabel = opportunity.verification?.label || "Opportunity card";
  context.font = "800 14px Arial, sans-serif";
  const trustWidth = context.measureText(trustLabel.toUpperCase()).width + 48;
  const trustX = 992 - trustWidth;
  roundedRect(context, trustX, 80, trustWidth, 40, 20, COLORS.mist);
  context.fillStyle = COLORS.green;
  context.beginPath();
  context.arc(trustX + 18, 100, 5, 0, Math.PI * 2);
  context.fill();
  context.fillText(trustLabel.toUpperCase(), trustX + 32, 105);

  context.strokeStyle = COLORS.line;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(194, 154);
  context.lineTo(992, 154);
  context.stroke();

  const category = (CATEGORY_LABELS[opportunity.category] || opportunity.category).toUpperCase();
  context.font = "800 16px Arial, sans-serif";
  const categoryWidth = context.measureText(category).width + 36;
  roundedRect(context, 194, 194, categoryWidth, 40, 20, COLORS.forest);
  context.fillStyle = "#ffffff";
  context.fillText(category, 211, 220);

  context.fillStyle = COLORS.green;
  context.font = "800 16px Arial, sans-serif";
  context.textAlign = "right";
  context.fillText("OPEN OPPORTUNITY", 992, 220);
  context.textAlign = "left";

  let titleSize = 68;
  let titleLines: string[] = [];
  do {
    context.font = `800 ${titleSize}px Arial, sans-serif`;
    titleLines = fitLines(context, opportunity.title, 798, 3);
    if (titleLines.length > 2) titleSize -= 3;
  } while (titleLines.length > 2 && titleSize > 52);
  context.fillStyle = COLORS.ink;
  drawLines(context, titleLines, 194, 304, titleSize + 9);

  const titleBottom = 304 + (titleLines.length - 1) * (titleSize + 9);
  context.fillStyle = COLORS.muted;
  context.font = "600 24px Arial, sans-serif";
  const provider = fitLines(context, `Offered by ${opportunity.provider}`, 760, 1);
  drawLines(context, provider, 194, titleBottom + 50, 28);

  const summaryY = Math.max(494, titleBottom + 96);
  context.fillStyle = COLORS.ink;
  context.font = "400 25px Arial, sans-serif";
  drawLines(context, fitLines(context, opportunity.summary, 780, 3), 194, summaryY, 36);

  const factsY = 666;
  const factWidth = 250;
  const facts = [
    ["DEADLINE", dateLabel(opportunity.deadline)],
    ["LOCATION", locationLabel(opportunity)],
    ["FORMAT", attendanceLabel(opportunity)],
  ];
  facts.forEach(([label, value], index) => {
    const x = 194 + index * 270;
    roundedRect(context, x, factsY, factWidth, 112, 18, index === 0 ? COLORS.mint : COLORS.mist);
    context.fillStyle = COLORS.green;
    context.font = "800 13px Arial, sans-serif";
    context.fillText(label, x + 20, factsY + 31);
    context.fillStyle = COLORS.ink;
    context.font = "700 20px Arial, sans-serif";
    drawLines(context, fitLines(context, value, factWidth - 40, 2), x + 20, factsY + 66, 25);
  });

  roundedRect(context, 194, 806, 798, 112, 18, COLORS.forest);
  context.fillStyle = "#9fe0ba";
  context.font = "800 13px Arial, sans-serif";
  context.fillText("WHAT IT OFFERS", 220, 838);
  context.fillStyle = "#ffffff";
  context.font = "700 22px Arial, sans-serif";
  drawLines(context, fitLines(context, opportunity.benefit || "See the official opportunity page for full benefits.", 744, 2), 220, 873, 29);

  context.fillStyle = COLORS.green;
  context.font = "800 24px Arial, sans-serif";
  context.fillText("Find what fits. Pass it on.", 194, 974);
  context.fillStyle = COLORS.muted;
  context.font = "700 22px Arial, sans-serif";
  context.textAlign = "right";
  context.fillText(hostLabel(shareUrl), 992, 974);
  context.textAlign = "left";

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not create the share image.")), "image/png");
  });
  const link = document.createElement("a");
  const filename = opportunity.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "opportunity";
  link.download = `${filename}-getneba.png`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}
