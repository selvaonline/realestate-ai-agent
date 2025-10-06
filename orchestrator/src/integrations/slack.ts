// src/integrations/slack.ts
// Slack webhook integration for Comet alerts

export async function postSlack(webhookUrl: string, payload: { text: string; blocks?: any[] }): Promise<void> {
  if (!webhookUrl) {
    console.log("[slack] No webhook URL configured, skipping notification");
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`[slack] Failed to post: ${response.status} ${response.statusText}`);
    } else {
      console.log("[slack] ✅ Notification sent successfully");
    }
  } catch (err) {
    console.error("[slack] Error posting notification:", err);
  }
}

export function formatCometAlert(watchLabel: string, newCount: number, changedCount: number, items: any[]): { text: string; blocks: any[] } {
  const emoji = newCount > 0 ? "🔔" : "📝";
  const title = `${emoji} ${watchLabel}`;
  const summary = `${newCount} new, ${changedCount} changed`;

  const text = `${title}: ${summary}`;

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: title,
        emoji: true
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${summary}*`
      }
    },
    {
      type: "divider"
    }
  ];

  // Add top 5 items
  const topItems = items.slice(0, 5);
  for (const item of topItems) {
    const scoreText = `PE: ${item.score} | Risk: ${item.risk}`;
    const titleText = item.title || "Property Listing";
    
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${item.url}|${titleText}>*\n${scoreText}${item.price ? ` | Price: ${item.price}` : ""}${item.capRate ? ` | Cap: ${item.capRate}` : ""}`
      }
    });
  }

  if (items.length > 5) {
    blocks.push({
      type: "context",
      elements: [{
        type: "mrkdwn",
        text: `_... and ${items.length - 5} more_`
      }]
    });
  }

  return { text, blocks };
}
