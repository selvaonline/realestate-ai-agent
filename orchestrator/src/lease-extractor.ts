// src/lease-extractor.ts
// Multi-layered Tenant & Lease Extraction Module
// Combines regex patterns, structured parsing, and LLM extraction

export interface LeaseTerms {
  leaseType: 'NNN' | 'Absolute Net' | 'Gross' | 'Modified Gross' | 'Unknown';
  corporateGuarantee: boolean | null;
  term: {
    start: string | null;
    end: string | null;
    remainingYears: number | null;
  };
  rentEscalation: {
    type: 'percent' | 'fixed' | 'CPI' | 'none' | null;
    value: number | null;
    frequency: 'annual' | 'biennial' | 'every5years' | null;
  };
  renewalOptions: {
    count: number | null;
    eachYears: number | null;
    basis: 'FMV' | 'Fixed' | 'CPI' | null;
  };
  tenant: {
    name: string | null;
    creditRating: string | null;
    isInvestmentGrade: boolean | null;
  };
  confidence: number;
  extractionMethod: 'regex' | 'llm' | 'hybrid';
  rawSnippets: string[];
}

/**
 * Step 1: Quick regex-based lease hints from SERPER snippets or page text
 * Fast, safe, no LLM cost - catches obvious patterns
 */
export function regexLeaseHints(text: string): Partial<LeaseTerms> {
  const normalized = text.toLowerCase();
  
  // Lease expiry patterns
  const expiryPatterns = [
    /lease (?:expires?|expiration|term ends?)[:\s]*([A-Za-z]{3,9}\s+\d{4})/i,
    /(?:expires?|expiration)[:\s]*(\d{1,2}\/\d{4})/i,
    /(?:through|until|to)\s+(\d{4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})\s*(?:expir|term)/i
  ];
  
  let expiry: string | null = null;
  for (const pattern of expiryPatterns) {
    const match = text.match(pattern);
    if (match) {
      expiry = match[1];
      break;
    }
  }
  
  // Escalation patterns
  const escalPct = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:annual|yearly)?\s*(?:rent )?(?:increase|escalation|bump)/i)?.[1] || null;
  const cpiEscal = normalized.includes('cpi') && normalized.includes('escalat');
  
  // Renewal options patterns
  const optionsMatch = text.match(/(\d+)\s*(?:x|×)\s*(\d+)\s*year\s*(?:renewal|option)/i);
  const renewalCount = optionsMatch ? Number(optionsMatch[1]) : null;
  const renewalYears = optionsMatch ? Number(optionsMatch[2]) : null;
  
  // Lease type detection
  let leaseType: LeaseTerms['leaseType'] = 'Unknown';
  if (normalized.includes('nnn') || normalized.includes('triple net') || normalized.includes('triple-net')) {
    leaseType = 'NNN';
  } else if (normalized.includes('absolute net')) {
    leaseType = 'Absolute Net';
  } else if (normalized.includes('gross lease')) {
    leaseType = 'Gross';
  } else if (normalized.includes('modified gross')) {
    leaseType = 'Modified Gross';
  }
  
  // Corporate guarantee detection
  const corporateGuarantee = normalized.includes('corporate guarantee') || 
                             normalized.includes('guaranteed by') ||
                             normalized.includes('parent guarantee');
  
  // Tenant credit rating hints
  const igTenants = ['walgreens', 'cvs', 'walmart', 'target', 'amazon', 'fedex', 'ups', 'dollar general'];
  const foundTenant = igTenants.find(t => normalized.includes(t));
  
  const rawSnippets: string[] = [];
  if (expiry) rawSnippets.push(`Expiry: ${expiry}`);
  if (escalPct) rawSnippets.push(`Escalation: ${escalPct}%`);
  if (renewalCount) rawSnippets.push(`Renewals: ${renewalCount}x${renewalYears}yr`);
  
  return {
    leaseType,
    corporateGuarantee: corporateGuarantee || null,
    term: {
      start: null,
      end: expiry,
      remainingYears: expiry ? calculateRemainingYears(expiry) : null
    },
    rentEscalation: {
      type: cpiEscal ? 'CPI' : (escalPct ? 'percent' : null),
      value: escalPct ? Number(escalPct) : null,
      frequency: escalPct ? 'annual' : null
    },
    renewalOptions: {
      count: renewalCount,
      eachYears: renewalYears,
      basis: null
    },
    tenant: {
      name: foundTenant ? foundTenant.charAt(0).toUpperCase() + foundTenant.slice(1) : null,
      creditRating: foundTenant ? inferCreditRating(foundTenant) : null,
      isInvestmentGrade: foundTenant ? true : null
    },
    confidence: 0.6, // Regex has moderate confidence
    extractionMethod: 'regex',
    rawSnippets
  };
}

/**
 * Step 2: LLM-based extraction using Claude/GPT for nuanced lease terms
 * Use when regex misses or for complex schedules
 */
export async function llmLeaseExtraction(
  text: string, 
  llmInvoke: (prompt: string) => Promise<string>
): Promise<Partial<LeaseTerms>> {
  
  const schema = `{
  "leaseType": "NNN | Absolute Net | Gross | Modified Gross | Unknown",
  "corporateGuarantee": boolean,
  "term": {
    "start": "YYYY-MM-DD or null",
    "end": "YYYY-MM-DD or null",
    "remainingYears": number
  },
  "rentEscalation": {
    "type": "percent | fixed | CPI | none",
    "value": number,
    "frequency": "annual | biennial | every5years"
  },
  "renewalOptions": {
    "count": number,
    "eachYears": number,
    "basis": "FMV | Fixed | CPI"
  },
  "tenant": {
    "name": string,
    "creditRating": "AAA | AA | A | BBB | BB | B | etc",
    "isInvestmentGrade": boolean
  },
  "confidence": 0.0-1.0
}`;

  const prompt = `You are a commercial real estate lease analyst. Extract lease details from the following property listing text and return ONLY valid JSON matching this exact schema. If information is missing, use null.

Schema:
${schema}

Property Listing Text:
"""
${text.slice(0, 4000)}
"""

Return only the JSON object, no markdown, no explanation:`;

  try {
    const response = await llmInvoke(prompt);
    
    // Clean response - remove markdown code blocks if present
    let cleaned = response.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    
    const parsed = JSON.parse(cleaned);
    
    return {
      ...parsed,
      extractionMethod: 'llm',
      rawSnippets: [`LLM extracted from ${text.slice(0, 100)}...`]
    };
  } catch (error) {
    console.error('[lease-extractor] LLM parsing failed:', error);
    return {
      confidence: 0,
      extractionMethod: 'llm',
      rawSnippets: ['LLM extraction failed']
    };
  }
}

/**
 * Step 3: Merge regex and LLM results with confidence weighting
 * Prefer regex for exact matches, LLM for nuanced extraction
 */
export function mergeLeaseExtractions(
  regex: Partial<LeaseTerms>,
  llm: Partial<LeaseTerms>
): LeaseTerms {
  
  // Prefer regex for exact date matches, LLM for complex terms
  const merged: LeaseTerms = {
    leaseType: llm.leaseType && llm.leaseType !== 'Unknown' ? llm.leaseType : (regex.leaseType || 'Unknown'),
    corporateGuarantee: llm.corporateGuarantee ?? regex.corporateGuarantee ?? null,
    
    term: {
      start: llm.term?.start || regex.term?.start || null,
      end: regex.term?.end || llm.term?.end || null, // Prefer regex for dates
      remainingYears: llm.term?.remainingYears || regex.term?.remainingYears || null
    },
    
    rentEscalation: {
      type: llm.rentEscalation?.type || regex.rentEscalation?.type || null,
      value: regex.rentEscalation?.value || llm.rentEscalation?.value || null, // Prefer regex for numbers
      frequency: llm.rentEscalation?.frequency || regex.rentEscalation?.frequency || null
    },
    
    renewalOptions: {
      count: regex.renewalOptions?.count || llm.renewalOptions?.count || null,
      eachYears: regex.renewalOptions?.eachYears || llm.renewalOptions?.eachYears || null,
      basis: llm.renewalOptions?.basis || regex.renewalOptions?.basis || null
    },
    
    tenant: {
      name: llm.tenant?.name || regex.tenant?.name || null,
      creditRating: llm.tenant?.creditRating || regex.tenant?.creditRating || null,
      isInvestmentGrade: llm.tenant?.isInvestmentGrade ?? regex.tenant?.isInvestmentGrade ?? null
    },
    
    // Weighted confidence: higher if both methods agree
    confidence: calculateMergedConfidence(regex, llm),
    extractionMethod: 'hybrid',
    rawSnippets: [...(regex.rawSnippets || []), ...(llm.rawSnippets || [])]
  };
  
  return merged;
}

/**
 * Calculate confidence score based on extraction method agreement
 */
function calculateMergedConfidence(
  regex: Partial<LeaseTerms>,
  llm: Partial<LeaseTerms>
): number {
  let score = 0.5; // Base confidence
  
  // Boost if both methods found lease type
  if (regex.leaseType && llm.leaseType && regex.leaseType === llm.leaseType) {
    score += 0.15;
  }
  
  // Boost if expiry dates match
  if (regex.term?.end && llm.term?.end && regex.term.end === llm.term.end) {
    score += 0.15;
  }
  
  // Boost if escalation values match
  if (regex.rentEscalation?.value && llm.rentEscalation?.value && 
      Math.abs(regex.rentEscalation.value - llm.rentEscalation.value) < 0.5) {
    score += 0.1;
  }
  
  // Boost if renewal options match
  if (regex.renewalOptions?.count && llm.renewalOptions?.count &&
      regex.renewalOptions.count === llm.renewalOptions.count) {
    score += 0.1;
  }
  
  return Math.min(score, 1.0);
}

/**
 * Helper: Calculate remaining years from expiry date string
 */
function calculateRemainingYears(expiryStr: string): number | null {
  try {
    const now = new Date();
    let expiryDate: Date;
    
    // Parse various date formats
    if (expiryStr.match(/^\d{4}$/)) {
      // Just year: "2032"
      expiryDate = new Date(`${expiryStr}-12-31`);
    } else if (expiryStr.match(/^\d{1,2}\/\d{4}$/)) {
      // Month/Year: "12/2032"
      const [month, year] = expiryStr.split('/');
      expiryDate = new Date(`${year}-${month.padStart(2, '0')}-01`);
    } else if (expiryStr.match(/^[A-Za-z]{3,9}\s+\d{4}$/)) {
      // "December 2032"
      expiryDate = new Date(expiryStr);
    } else {
      expiryDate = new Date(expiryStr);
    }
    
    if (isNaN(expiryDate.getTime())) return null;
    
    const diffMs = expiryDate.getTime() - now.getTime();
    const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
    
    return Math.max(0, Math.round(diffYears * 10) / 10); // Round to 1 decimal
  } catch {
    return null;
  }
}

/**
 * Helper: Infer credit rating from known IG tenants
 */
function inferCreditRating(tenant: string): string | null {
  const ratings: Record<string, string> = {
    'walmart': 'AA',
    'amazon': 'AA',
    'target': 'A',
    'walgreens': 'BBB',
    'cvs': 'BBB',
    'fedex': 'BBB',
    'ups': 'A',
    'dollar general': 'BBB',
    'dollar tree': 'BBB'
  };
  
  return ratings[tenant.toLowerCase()] || null;
}

/**
 * Main extraction orchestrator
 * Runs regex first, then LLM if needed, then merges
 */
export async function extractLeaseTerms(
  text: string,
  llmInvoke?: (prompt: string) => Promise<string>,
  options: { skipLLM?: boolean } = {}
): Promise<LeaseTerms> {
  
  // Step 1: Always run regex (fast, cheap)
  const regexResults = regexLeaseHints(text);
  
  // Step 2: Run LLM if available and not skipped
  if (llmInvoke && !options.skipLLM) {
    const llmResults = await llmLeaseExtraction(text, llmInvoke);
    
    // Step 3: Merge results
    return mergeLeaseExtractions(regexResults, llmResults);
  }
  
  // Return regex-only results with adjusted confidence
  return {
    leaseType: regexResults.leaseType || 'Unknown',
    corporateGuarantee: regexResults.corporateGuarantee || null,
    term: regexResults.term || { start: null, end: null, remainingYears: null },
    rentEscalation: regexResults.rentEscalation || { type: null, value: null, frequency: null },
    renewalOptions: regexResults.renewalOptions || { count: null, eachYears: null, basis: null },
    tenant: regexResults.tenant || { name: null, creditRating: null, isInvestmentGrade: null },
    confidence: regexResults.confidence || 0.5,
    extractionMethod: regexResults.extractionMethod || 'regex',
    rawSnippets: regexResults.rawSnippets || []
  };
}
