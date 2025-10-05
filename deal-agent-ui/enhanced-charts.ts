// Enhanced Chart.js Configuration with Center Labels and Dynamic Colors
// Drop-in replacement for portfolio analytics charts

/** ========= Helpers ========= */
const fmtPct = (num: number) => `${Math.round(num * 100)}%`;
const sum = (arr: number[]) => arr.reduce((a,b)=>a+b,0);

/** ======= Dynamic colors ======= */
/* Score donuts: red for <70, amber 70-79, green >=80 */
const SCORE_COLORS = {
  premium: { bg: "#E5F5EC", fg: "#2F8F5B" },        // >=80 (green)
  investment: { bg: "#FFF1E3", fg: "#F28B30" },    // 70–79 (amber)
  below: { bg: "#FDECEA", fg: "#D9534F" }          // <70 (red)
};

/* Geography: distinct palette */
const GEO_PALETTE = [
  "#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6",
  "#14B8A6","#84CC16","#EC4899","#22C55E","#F97316"
];

/** ======= Center label plugin ======= */
const doughnutCenterPlugin = {
  id: "doughnutCenter",
  afterDraw(chart: any, args: any, opts: any) {
    const { ctx, chartArea: { width, height } } = chart;
    ctx.save();
    
    // Get center coordinates from first data point
    const centerX = chart.getDatasetMeta(0).data[0]?.x || width / 2;
    const centerY = chart.getDatasetMeta(0).data[0]?.y || height / 2;

    // Title line
    ctx.fillStyle = opts.titleColor || "#6B7280";
    ctx.font = `600 ${opts.titleSize || 12}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(opts.title || "", centerX, centerY - 8);

    // Value line
    ctx.fillStyle = opts.valueColor || "#111827";
    ctx.font = `700 ${opts.valueSize || 20}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
    ctx.fillText(opts.value || "", centerX, centerY + 12);
    ctx.restore();
  }
};

/** ======= Enhanced Chart Creation Function ======= */
export function createEnhancedPortfolioCharts(portfolioData: any) {
  const buckets = portfolioData.scoreDistribution || { premium: 0, investmentGrade: 0, belowThreshold: 0 };
  const total = portfolioData.sources || (buckets.premium + buckets.investmentGrade + buckets.belowThreshold) || 0;
  const avgScore = portfolioData.avgScore ?? 0;
  
  const geo = portfolioData.geoDistribution || { Other: total || 0 };
  const geoLabels = Object.keys(geo);
  const geoCounts = Object.values(geo) as number[];
  const geoBg = geoLabels.map((_,i)=>GEO_PALETTE[i % GEO_PALETTE.length]);
  
  /** ======= Score Distribution donut ======= */
  const scoreCtx = document.getElementById("score-distribution-chart") as HTMLCanvasElement;
  if (scoreCtx) {
    const ctx = scoreCtx.getContext('2d');
    if (ctx) {
      const data = {
        labels: ["Premium (≥80)","Investment Grade (70–79)","Below Threshold (<70)"],
        datasets: [{
          data: [buckets.premium, buckets.investmentGrade, buckets.belowThreshold],
          backgroundColor: [SCORE_COLORS.premium.bg, SCORE_COLORS.investment.bg, SCORE_COLORS.below.bg],
          borderColor: [SCORE_COLORS.premium.fg, SCORE_COLORS.investment.fg, SCORE_COLORS.below.fg],
          borderWidth: 1.5,
          hoverOffset: 6
        }]
      };

      new (window as any).Chart(ctx, {
        type: "doughnut",
        data,
        plugins: [doughnutCenterPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: "68%",
          plugins: {
            legend: { 
              position: "bottom", 
              labels: { 
                usePointStyle: true, 
                boxWidth: 8,
                color: '#1a2332',
                font: { size: 11 },
                padding: 10
              } 
            },
            tooltip: {
              callbacks: {
                label: (ctx: any) => {
                  const val = ctx.parsed;
                  const pct = total ? ` (${fmtPct(val/total)})` : "";
                  return ` ${ctx.label}: ${val}${pct}`;
                }
              }
            },
            // Center label
            doughnutCenter: {
              title: "Avg Score",
              value: String(avgScore),
              titleSize: 12,
              valueSize: 20,
              titleColor: "#6B7280",
              valueColor: "#111827"
            }
          }
        }
      });
    }
  }

  /** ======= Geographic Distribution donut ======= */
  const geoCtx = document.getElementById("geo-distribution-chart") as HTMLCanvasElement;
  if (geoCtx) {
    const ctx = geoCtx.getContext('2d');
    if (ctx) {
      const sumGeo = sum(geoCounts);
      const data = {
        labels: geoLabels,
        datasets: [{
          data: geoCounts,
          backgroundColor: geoBg,
          borderColor: geoBg,
          borderWidth: 1.5,
          hoverOffset: 6
        }]
      };

      new (window as any).Chart(ctx, {
        type: "doughnut",
        data,
        plugins: [doughnutCenterPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: "68%",
          plugins: {
            legend: { 
              position: "bottom", 
              labels: { 
                usePointStyle: true, 
                boxWidth: 8,
                color: '#1a2332',
                font: { size: 11 },
                padding: 10
              } 
            },
            tooltip: {
              callbacks: {
                label: (ctx: any) => {
                  const val = ctx.parsed;
                  const pct = sumGeo ? ` (${fmtPct(val/sumGeo)})` : "";
                  return ` ${ctx.label}: ${val}${pct}`;
                }
              }
            },
            doughnutCenter: {
              title: "Total",
              value: String(sumGeo),
              titleSize: 12,
              valueSize: 20,
              titleColor: "#6B7280",
              valueColor: "#111827"
            }
          }
        }
      });
    }
  }

  /** ======= Optional: Macro banner (tiny trend cue) ======= */
  const macro = portfolioData.macro;
  if (macro && (macro.tenY != null || macro.riskScore != null)) {
    const host = document.getElementById("portfolio-charts")?.parentElement;
    if (host) {
      const note = document.createElement("div");
      note.style.cssText = "margin:8px 0 16px 0; color:#475569; font-size:13px;";
      
      const tenYText = macro.tenY != null ? `📈 10Y Treasury: ${(macro.tenY*100).toFixed(2)}%` : "";
      const deltaText = macro.tenYDeltaBps != null ? ` ${macro.tenYDeltaBps>0?'↑':'↓'} (${Math.abs(macro.tenYDeltaBps)} bps MoM)` : "";
      const riskText = macro.riskScore != null ? ` · Market Risk: ${macro.riskScore}/100` : "";
      
      note.innerHTML = `${tenYText}${deltaText}${riskText}`;
      host.prepend(note);
    }
  }
}
