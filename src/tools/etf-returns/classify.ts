export interface Classification {
  exposureId: string;
  /** Daily-reset multiple. 1 is unlevered, 2 is twice long, −1 is short. */
  leverage: number;
  hedgedToEur: boolean;
}

export function normalizeEtfText(name: string, indexName = ''): string {
  return `${name} ${indexName}`
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[‐‑–—]/g, '-')
    .replace(/[^a-z0-9.+%.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function leverageFrom(text: string): number {
  const duration = /short duration|short-duration|short term|short-term|ultrashort|short dated|short-dated|short maturity/.test(text);
  const bondish = /bond|treasury|gilt|sovereign|overnight|government|pfandbrief|covered/.test(text);
  const inverse = /inverse|shortdax|short dax|short daily|xshort/.test(text)
    || (/\bshort\b/.test(text) && !duration && !bondish);
  let magnitude = 1;
  if (/\b3x\b|\bx3\b|triple/.test(text)) magnitude = 3;
  else if (/\b2x\b|\bx2\b/.test(text)) magnitude = 2;
  else if (/\b1x\b/.test(text)) magnitude = 1;
  else if (/levdax|leveraged/.test(text)) magnitude = 2;
  return inverse ? -magnitude : magnitude;
}

export function hedgedToEur(text: string): boolean {
  if (/unhedged|nicht wahrungsgesichert|nicht währungsgesichert/.test(text)) return false;
  if (/gbp hedged|gbp hdg|chf hedged|usd hedged|usd hdg|hedged to usd|hedged usd|hedged to gbp/.test(text)) {
    return false;
  }
  return /eur hedged|eur-hedged|euro hedged|hedged eur|eur hdg|hedged to eur|wahrungsgesichert|währungsgesichert|\bheur\b|h eur/.test(text);
}

function bondExposure(text: string): string {
  if (/overnight|money market|ultrashort|fed funds/.test(text)) return 'cash';
  const long = /25\+|15-30|15\+|10\+|30\+|long dated|long-dated|longer dated/.test(text);
  const short = /0-1|1-3|0-3|short duration|short-duration|short term|short-term|short dated|short-dated/.test(text);
  const linker = /inflation-linked|inflation linked|\btips\b|linker/.test(text);
  const highYield = /high yield|high-yield/.test(text);
  const em = /emerging|em local|em bond|\bem\b|j\.p\. morgan|j p morgan|jp morgan/.test(text);
  const usa = /treasury|\btips\b|u\.s\.|united states|\busd\b|\bus\b|dollar/.test(text);
  const uk = /gilt|\buk\b|united kingdom/.test(text);

  if (em && /local/.test(text)) return 'em-bond-local';
  if (em && !/equity|msci em /.test(text)) return 'em-bond';
  if (linker && usa) return 'us-linker';
  if (linker) return 'euro-linker';
  if (/pfandbrief|covered/.test(text)) return 'euro-covered';
  if (uk && /gilt|bond|government|gov/.test(text)) return 'uk-gilt';
  if (usa && /treasury|government bond|gov bond|t-bill/.test(text)) {
    if (long) return 'us-treasury-long';
    if (short) return 'us-treasury-short';
    return 'us-treasury';
  }
  if (highYield && usa) return 'us-hy';
  if (highYield) return 'euro-hy';
  if (/\bbund\b/.test(text)) return 'euro-gov';
  if (/corporate|corporates|\bcorp\b|credit|floating rate/.test(text) && usa) return 'us-ig';
  if (/corporate|corporates|\bcorp\b|credit|floating rate/.test(text)) return 'euro-ig';
  if (/global|world/.test(text) && /bond|aggregate|government|treasury/.test(text)) return 'global-bond';
  if (long) return 'euro-gov-long';
  if (short) return 'euro-gov-short';
  if (/bond|government|govt|sovereign|treasury|gilt|iboxx|aggregate/.test(text)) return 'euro-gov';
  return 'global-bond';
}

function equityExposure(text: string): string {
  if (/bitcoin|ethereum|\bether\b|\bcrypto\b/.test(text)) return 'crypto';
  if (/gold bugs|gold miner|goldmin|rare earth|strategic metal|essential metal|metal producer|metals and mining|\bmining\b/.test(text)) {
    return /gold/.test(text) ? 'gold-miners' : 'metals';
  }
  if (/silver|platinum|\bgold\b|precious metal/.test(text)) return /silver|platinum/.test(text) && !/gold/.test(text) ? 'commodity' : 'gold';
  if (/commodit|cmci/.test(text)) return 'commodity';

  if (/bond|govt|government|eurogov|\bgov\b|treasury|gilt|pfandbrief|sovereign|overnight|money market|ultrashort|inflation-linked|inflation linked|covered bond|high yield|high-yield|corporate|corporates|\bcorp\b|\bbund\b|fed funds|floating rate|iboxx|\btips\b/.test(text)) {
    return bondExposure(text);
  }

  if (/balanced|multi-asset|multi asset|allocation|portfolio/.test(text)) return 'balanced';

  if (/semiconductor|\bchip\b/.test(text)) return 'semiconductors';
  if (/robot|automation|artificial intelligence|big data|\bai\b|smart factory/.test(text)) return 'robotics';
  if (/clean energy|renewable|new energy|hydrogen|solar|wind power|bioenergy|green energy|environmental/.test(text)) return 'clean-energy';
  if (/defense|defence/.test(text)) return 'defense';
  if (/\bwater\b/.test(text)) return 'water';
  if (/infrastructure/.test(text)) return 'infrastructure';
  if (/real estate|\breit\b|property yield|property|epra|nareit/.test(text)) return 'real-estate';
  if (/biotech|biotechnology|genomic/.test(text)) return 'biotech';
  if (/health care|healthcare|pharma|cannabis|life science/.test(text)) return 'health';
  if (/energy|\boil\b|\bgas\b/.test(text)) return 'energy';
  if (/financial|bank|insurance/.test(text)) return 'financials';
  if (/consumer staple|staples|\bfood\b/.test(text)) return 'staples';
  if (/discretionary/.test(text)) return 'discretionary';
  if (/information technology|information tech|cyber|digital payment|ecommerce|e-commerce|education tech|\btech\b/.test(text)) return 'tech';
  if (/technolog/.test(text)) return 'tech';
  if (/circular economy|\bspace\b/.test(text)) return 'industrials';
  if (/industrial/.test(text)) return 'industrials';
  if (/natural resource/.test(text)) return 'materials';
  if (/material/.test(text)) return 'materials';
  if (/utilit/.test(text)) return 'utilities';
  if (/communication|telecom/.test(text)) return 'communication';

  if (/dividend|aristocrat/.test(text)) return 'dividend';
  if (/minimum volatility|min vol|minimum variance|low volatility/.test(text)) return 'min-vol';
  if (/\bquality\b|\bmoat\b/.test(text)) return 'quality';
  if (/\bmomentum\b/.test(text)) return 'momentum';
  if (/\bvalue\b/.test(text)) return 'value';
  if (/small cap|small-cap|smallcap|mid cap|mid-cap|s and p 400|s&p 400/.test(text)) return 'small-cap';

  if (/nasdaq/.test(text)) return 'nasdaq';
  if (/s and p 500|s&p 500|\bmsci usa\b|\brussell\b|dow jones industrial|u\.s\. equity|us equity|\bunited states\b/.test(text)) return 'usa';
  if (/\bnorth america\b/.test(text)) return 'usa';
  if (/dax|mdax|sdax|tecdax|divdax|\bgermany\b|deutsch/.test(text)) return 'germany';
  if (/euro stoxx|eurostoxx|\bemu\b|eurozone|euro zone|euro prime/.test(text)) return 'emu';
  if (/ftse 100|ftse 250|\bftse uk\b|\bmsci uk\b|\bunited kingdom\b/.test(text)) return 'uk';
  if (/japan|nikkei|topix|\bjpx\b/.test(text)) return 'japan';
  if (/china|\bcsi\b|hang seng/.test(text)) return 'china';
  if (/india|nifty/.test(text)) return 'india';
  if (/pacific|asia ex japan|asia pacific/.test(text)) return 'pacific';
  if (/emerging|\bfrontier\b|latin america|\bmsci em\b|\bem imi\b|\bem asia\b|africa|bic 50/.test(text)) return 'em';
  if (/switzerland|\bsmi\b|\bsli\b|\bspi\b|\bcanada\b|\baustralia\b|\basx\b|\bfrance\b|cac 40|cac40|nordic|\baustria\b|\batx\b|\bnetherlands\b|\bitaly\b|\bmib\b|\bspain\b|hong kong|singapore|\bpsi\b|israel|ta-35|f\.a\.z|faz 100/.test(text)) {
    return 'dm-country';
  }
  if (/brazil|korea|taiwan|mexico|malaysia|indonesia|thailand|turkey|poland|south africa|vietnam|philippines|chile|saudi|greece|russia|pakistan|\bgcc\b/.test(text)) {
    return 'em-country';
  }
  if (/all country|all-world|all world|\bacwi\b|ftse all-world|ftse all world/.test(text)) return 'acwi';
  if (/\bmsci world\b|\bworld\b|developed world|global equity|global titans|ftse developed|\bglobal\b/.test(text)) return 'world';
  if (/private equity|privex/.test(text)) return 'financials';
  if (/inclusion|diversity/.test(text)) return 'world';
  if (/europe|\bstoxx\b/.test(text)) return 'europe';
  return 'equity-other';
}

export function classifyEtf(name: string, indexName = ''): Classification {
  const text = normalizeEtfText(name, indexName);
  return {
    exposureId: equityExposure(text),
    leverage: leverageFrom(text),
    hedgedToEur: hedgedToEur(text),
  };
}
