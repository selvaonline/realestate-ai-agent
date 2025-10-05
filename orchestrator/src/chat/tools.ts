// src/chat/tools.ts
// Tool definitions for UI drill-in actions

import type OpenAI from "openai";

/**
 * UI action tools that the chatbot can call to trigger frontend actions
 */
export const uiActionTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "ui_open_card",
      description: "Open a property detail card in the UI by rank (1-based index) or URL. Use this when user asks to 'show me deal #2' or 'open the Walgreens property'.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "1-based rank of the deal in current results (e.g., 1 for top deal)"
          },
          url: {
            type: "string",
            description: "Direct URL of the property listing"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ui_render_charts",
      description: "Render factor breakdown or portfolio analytics charts in the UI. Use when user asks to 'show me the charts' or 'visualize the portfolio'.",
      parameters: {
        type: "object",
        properties: {
          scope: {
            type: "string",
            enum: ["deal", "portfolio"],
            description: "'deal' for single property factor charts, 'portfolio' for aggregate analytics"
          },
          id: {
            type: "number",
            description: "Deal rank (1-based) if scope is 'deal'"
          }
        },
        required: ["scope"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ui_export_memo",
      description: "Export an IC (Investment Committee) memo for a specific deal. Use when user asks to 'create a memo' or 'export deal #1'.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "1-based rank of the deal"
          },
          url: {
            type: "string",
            description: "Direct URL of the property"
          },
          format: {
            type: "string",
            enum: ["txt", "docx", "pdf"],
            description: "Export format (default: txt)",
            default: "txt"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ui_scroll_to_deal",
      description: "Scroll the UI to a specific deal card. Use when user asks to 'go to deal #3' or 'show me the second property'.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "number",
            description: "1-based rank of the deal to scroll to"
          }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ui_filter_deals",
      description: "Apply filters to the current deal list. Use when user asks to 'show only premium deals' or 'filter by Texas'.",
      parameters: {
        type: "object",
        properties: {
          tier: {
            type: "string",
            enum: ["Premium", "Investment Grade", "Below Threshold"],
            description: "Filter by PE tier"
          },
          location: {
            type: "string",
            description: "Filter by location/state"
          },
          minPE: {
            type: "number",
            description: "Minimum PE score"
          },
          maxRisk: {
            type: "number",
            description: "Maximum risk score"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ui_compare_deals",
      description: "Open a side-by-side comparison view for multiple deals. Use when user asks to 'compare deal #1 and #3'.",
      parameters: {
        type: "object",
        properties: {
          ids: {
            type: "array",
            items: { type: "number" },
            description: "Array of deal ranks (1-based) to compare"
          }
        },
        required: ["ids"]
      }
    }
  }
];

/**
 * Combined tools: existing search/analysis tools + UI action tools
 */
export function getAllChatTools(includeUIActions = true): OpenAI.Chat.Completions.ChatCompletionTool[] {
  const searchTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "web_search",
        description: "Search CRE listings across CREXi, LoopNet, Brevitas, CommercialExchange, Biproxi. Returns scored and ranked results.",
        parameters: {
          type: "object",
          properties: {
            query: { 
              type: "string",
              description: "The search query for commercial real estate listings"
            },
            maxResults: { 
              type: "number",
              description: "Maximum number of results to return (default 20)"
            }
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "generate_ic_memo",
        description: "Create IC-ready memo for a specific scored row (by index or URL).",
        parameters: {
          type: "object",
          properties: {
            title: { 
              type: "string",
              description: "Property title"
            },
            url: { 
              type: "string",
              description: "Property listing URL"
            },
            pe: { 
              type: "object",
              description: "PE score data with factors"
            },
            risk: { 
              type: "object",
              description: "Risk score data"
            },
            snippet: {
              type: "string",
              description: "Property description snippet"
            }
          },
          required: ["title", "url"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "analyze_context",
        description: "Analyze the current portfolio context (scored rows, portfolio data) to answer questions about deals, scores, and statistics.",
        parameters: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description: "The question to answer about the current context"
            }
          },
          required: ["question"]
        }
      }
    }
  ];

  return includeUIActions ? [...searchTools, ...uiActionTools] : searchTools;
}
