// src/utils/marketPricing.ts

interface PricePoint {
  date: string;
  price: number;
}

// Prix de base Open Web (Display Standard France = référence)
const BASE_PRICES: Record<string, number> = {
  "Display Standard": 1.20,
  "Display Rich Media": 2.50,
  "Video Pre-roll": 8.50,
  "Video Mid-roll": 9.20,
  "Native": 2.10,
  "Audio Digital": 5.20,
};

// Multiplicateurs par pays
const COUNTRY_MULTIPLIERS: Record<string, number> = {
  "France": 1.00,
  "Italie": 0.75,    // 25% moins cher
  "Belgique": 1.25,  // 25% plus cher
};

/**
 * Saisonnalité du marché programmatique (cycles réels observés)
 */
function getSeasonality(date: Date): number {
  const month = date.getMonth(); // 0-11
  const day = date.getDate();
  
  // Q4 (Oct-Nov-Dec) : PEAK SEASON
  if (month === 9) return 1.15 + (day / 31) * 0.15; // Octobre : 1.15 → 1.30
  if (month === 10) return 1.30 + (day / 30) * 0.05; // Novembre : 1.30 → 1.35
  if (month === 11) return 1.35 + (day / 31) * 0.05; // Décembre : 1.35 → 1.40
  
  // Janvier : POST-HOLIDAY CRASH
  if (month === 0) return 0.85;
  
  // Février-Mars : RECOVERY
  if (month === 1) return 0.90;
  if (month === 2) return 0.95;
  
  // Avril-Mai : STABLE
  if (month === 3 || month === 4) return 1.00;
  
  // Été (Juin-Juillet-Août) : SUMMER SLUMP
  if (month === 5) return 0.90 - (day / 30) * 0.10; // Juin : 0.90 → 0.80
  if (month === 6) return 0.80; // Juillet : creux absolu
  if (month === 7) return 0.80 + (day / 31) * 0.10; // Août : 0.80 → 0.90
  
  // Septembre : BACK TO SCHOOL
  if (month === 8) return 0.95 + (day / 30) * 0.20; // Septembre : 0.95 → 1.15
  
  return 1.00;
}

/**
 * Impact jour de semaine
 */
function getWeekdayFactor(date: Date): number {
  const day = date.getDay();
  if (day === 0 || day === 6) return 0.85; // Weekend -15%
  if (day === 1) return 0.95; // Lundi
  if (day === 5) return 0.98; // Vendredi
  return 1.00; // Mardi-Jeudi : peak
}

/**
 * Génère l'historique de prix sur N jours
 */
export function generateMarketHistory(
  format: string,
  country: string,
  days: number = 365
): PricePoint[] {
  const basePrice = BASE_PRICES[format] || 1.20;
  const countryMult = COUNTRY_MULTIPLIERS[country] || 1.00;
  
  const history: PricePoint[] = [];
  const today = new Date();
  
  // Croissance annuelle du marché : +8%
  const annualGrowth = 0.08;
  
  // Volatilité quotidienne
  const volatility = 0.03;
  
  let price = basePrice * countryMult;
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    
    // 1. Trend de croissance
    const trendFactor = 1 + (annualGrowth * ((days - i) / days));
    
    // 2. Saisonnalité
    const seasonFactor = getSeasonality(date);
    
    // 3. Jour de semaine
    const weekdayFactor = getWeekdayFactor(date);
    
    // 4. Bruit brownien (random walk)
    const randomShock = (Math.random() - 0.5) * 2 * volatility;
    
    // 5. Mean reversion (évite divergence)
    const targetPrice = basePrice * countryMult * trendFactor * seasonFactor * weekdayFactor;
    const meanReversion = (targetPrice - price) * 0.05;
    
    price = price * (1 + randomShock) + meanReversion;
    
    // Bornes de sécurité
    price = Math.max(price, basePrice * countryMult * 0.5);
    price = Math.min(price, basePrice * countryMult * 2.0);
    
    history.push({
      date: date.toISOString().split('T')[0],
      price: parseFloat(price.toFixed(2))
    });
  }
  
  return history;
}

/**
 * Prix actuel (moyenne 7 derniers jours)
 */
export function getCurrentPrice(format: string, country: string): number {
  const last7Days = generateMarketHistory(format, country, 7);
  const avg = last7Days.reduce((sum, p) => sum + p.price, 0) / 7;
  return parseFloat(avg.toFixed(2));
}

/**
 * Formats disponibles
 */
export function getAvailableFormats(): string[] {
  return Object.keys(BASE_PRICES);
}

/**
 * Pays disponibles
 */
export function getAvailableCountries(): string[] {
  return Object.keys(COUNTRY_MULTIPLIERS);
}

/**
 * Calcul RSI (Relative Strength Index)
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}
