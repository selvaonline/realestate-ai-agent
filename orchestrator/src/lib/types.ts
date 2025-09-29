export type Deal = {
    title: string | null;
    url: string;
    source: string | null;
    address: string | null;
    city?: string | null;
    state?: string | null;
    lat?: number | null;
    lng?: number | null;
    assetType?: string | null;
    size?: string | null; // units/sf
    askingPrice?: number | null;
    noi?: number | null;
    capRate?: number | null;
    yearBuilt?: string | null;
    occupancy?: string | null;
    screenshotBase64?: string | null;
    raw?: any;
    underwrite?: { capRate?: number | null; dscr?: number | null; loanAmt?: number | null; debtSvc?: number | null };
  };
  