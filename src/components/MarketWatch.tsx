// src/components/MarketWatch.tsx

import { useState, useMemo } from "react";
import { cn } from "../utils/cn";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Info, DollarSign, Activity, Target, AlertCircle } from "lucide-react";
import { 
  generateMarketHistory, 
  getCurrentPrice, 
  getAvailableFormats, 
  getAvailableCountries,
  calculateRSI 
} from "../utils/marketPricing";

interface MarketWatchProps {
  currentCost: number;
}

export function MarketWatch({ currentCost }: MarketWatchProps) {
  const [country, setCountry] = useState("France");
  const [format, setFormat] = useState("Video Pre-roll");
  const [timeRange, setTimeRange] = useState(365);

  const availableCountries = getAvailableCountries();
  const availableFormats = getAvailableFormats();

  // Historique des prix
  const history = useMemo(() => {
    return generateMarketHistory(format, country, timeRange);
  }, [format, country, timeRange]);

  // Prix actuel du marché
  const marketPrice = useMemo(() => {
    return getCurrentPrice(format, country);
  }, [format, country]);

  // Statistiques
  const stats = useMemo(() => {
    const prices = history.map(h => h.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const priceChange = ((lastPrice / firstPrice) - 1) * 100;
    
    // Volatilité (écart-type)
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance);
    
    // RSI
    const rsi = calculateRSI(prices, 14);
    
    return { min, max, priceChange, volatility, mean, rsi };
  }, [history]);

  // Comparaison vs ton cost
  const comparison = useMemo(() => {
    if (currentCost === 0) return null;
    
    const diff = currentCost - marketPrice;
    const diffPct = (diff / marketPrice) * 100;
    
    let status: "excellent" | "good" | "warning" | "danger";
    let message: string;
    
    if (diffPct <= -10) {
      status = "excellent";
      message = "Excellent ! Tu achètes 10%+ moins cher que le marché.";
    } else if (diffPct <= 0) {
      status = "good";
      message = "Bon prix. Tu es dans la fourchette basse du marché.";
    } else if (diffPct <= 10) {
      status = "warning";
      message = "Attention. Tu paies un peu plus cher que le marché.";
    } else {
      status = "danger";
      message = "Alerte ! Tu surpaies de +10% vs le marché.";
    }
    
    return { diff, diffPct, status, message };
  }, [currentCost, marketPrice]);

  // Signal trading simple
  const signal = useMemo(() => {
    const { rsi, priceChange } = stats;
    
    if (rsi < 30 && priceChange < -5) {
      return { 
        type: "BUY" as const, 
        label: "ACHETER", 
        reason: "Prix en correction + RSI oversold" 
      };
    }
    
    if (rsi > 70 && priceChange > 10) {
      return { 
        type: "SELL" as const, 
        label: "AUGMENTER MARGE", 
        reason: "Prix surchauffe + RSI overbought" 
      };
    }
    
    return { 
      type: "HOLD" as const, 
      label: "STABLE", 
      reason: "Marché équilibré" 
    };
  }, [stats]);

  // Données graphique avec MA7
  const chartData = useMemo(() => {
    return history.map((h, idx) => {
      let ma7 = h.price;
      if (idx >= 6) {
        ma7 = history.slice(idx - 6, idx + 1).reduce((acc, p) => acc + p.price, 0) / 7;
      }
      
      const dateObj = new Date(h.date);
      let dateLabel = dateObj.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: 'short'
      });
      
      if (timeRange > 90) {
        dateLabel = dateObj.toLocaleDateString('fr-FR', { 
          month: 'short',
          year: '2-digit'
        });
      }
      
      return {
        dateLabel,
        fullDate: h.date,
        price: h.price,
        ma7
      };
    });
  }, [history, timeRange]);

  return (
    <div className="p-8 h-full overflow-y-auto bg-[#f8f9fa]">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Market Watch</h2>
          <div className="text-sm text-gray-500 font-medium flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Prix actualisés en temps réel
          </div>
        </div>

        {/* 🔴 ENCADRÉ CRITIQUE : TARGETING PUR + OPEN WEB + RSI EXPLIQUÉ */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-2xl p-5 shadow-md space-y-4">
          <div className="flex items-start gap-4">
            <div className="bg-white p-3 rounded-xl shadow-sm shrink-0">
              <Info className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-blue-900 text-lg mb-2">
                📊 Prix Open Auction • Targeting Pur
              </h3>
              <p className="text-blue-800 text-sm leading-relaxed mb-3">
                Les prix affichés représentent le <strong>marché libre (Open Auction)</strong> sur l'Open Web 
                en <strong>Targeting pur</strong> (audiences contextuelles, géo, socio-démo).
              </p>
              <div className="bg-blue-100 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 font-medium space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">✅ Inclus :</span>
                  <span>Contextual, Geo-Targeting, Démographie</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">❌ Exclus :</span>
                  <span>Retargeting, Deals privés (PMP), Programmatic Guaranteed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Explication RSI */}
          <div className="flex items-start gap-4 bg-white/60 rounded-xl p-4 border border-blue-200">
            <div className="bg-indigo-100 p-2 rounded-lg shrink-0">
              <AlertCircle className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h4 className="font-bold text-indigo-900 text-sm mb-1">
                📈 RSI (Relative Strength Index)
              </h4>
              <p className="text-indigo-800 text-xs leading-relaxed">
                Indicateur de momentum sur 14 jours. <strong>RSI &lt; 30 = Oversold</strong> (marché survendu, 
                signal d'achat). <strong>RSI &gt; 70 = Overbought</strong> (marché surchauffé, signal de vente). 
                Entre 30-70 = zone neutre.
              </p>
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 grid grid-cols-3 gap-5">
          <div>
            <label className="block text-
