import { useState, useMemo } from "react";
import { cn } from "../utils/cn";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// Simulated market data
const MARKET_DATA = {
  "DV360 (Google)": {
    fees_dsp: 15,
    France: { "Display Standard": 1.2, "Video Pre-roll": 8.5, "Native": 2.1 },
    Italie: { "Display Standard": 0.9, "Video Pre-roll": 6.5, "Native": 1.8 },
    Belgique: { "Display Standard": 1.5, "Video Pre-roll": 10.0, "Native": 2.5 },
  },
  "The Trade Desk (TTD)": {
    fees_dsp: 12,
    France: { "Display Standard": 1.1, "Video Pre-roll": 8.0, "Native": 2.0 },
    Italie: { "Display Standard": 0.8, "Video Pre-roll": 6.0, "Native": 1.7 },
    Belgique: { "Display Standard": 1.4, "Video Pre-roll": 9.5, "Native": 2.4 },
  },
  "Amazon DSP": {
    fees_dsp: 10,
    France: { "Display Standard": 1.5, "Video Pre-roll": 9.0, "Native": 2.5 },
    Italie: { "Display Standard": 1.2, "Video Pre-roll": 7.0, "Native": 2.0 },
    Belgique: { "Display Standard": 1.8, "Video Pre-roll": 11.0, "Native": 3.0 },
  }
};

interface MarketWatchProps {
  currentCost: number;
}

export function MarketWatch({ currentCost }: MarketWatchProps) {
  const [country, setCountry] = useState("France");
  const [dsp, setDsp] = useState("DV360 (Google)");
  const [category, setCategory] = useState("Tous");
  const [timeRange, setTimeRange] = useState("Month -1");

  const marketInfo = MARKET_DATA[dsp as keyof typeof MARKET_DATA];
  const fees = marketInfo?.fees_dsp || 15;
  const formatsData = marketInfo?.[country as keyof typeof marketInfo] as Record<string, number> || {};

  const rows = useMemo(() => {
    return Object.entries(formatsData).map(([formatName, baseCpm]) => {
      const isDisplay = formatName.includes("Display") || formatName.includes("Sponsored");
      const isVideo = formatName.includes("Video") || formatName.includes("Pre-roll");
      const isNative = formatName.includes("Native");

      let show = false;
      if (category === "Tous") show = true;
      else if (category === "Display" && isDisplay) show = true;
      else if (category === "Video" && isVideo) show = true;
      else if (category === "Native" && isNative) show = true;

      if (!show) return null;

      // Simulate live variation +/- 3%
      const liveCpm = baseCpm * (0.97 + Math.random() * 0.06);
      
      let diffPct = 0;
      let vsIcon = Minus;
      let vsColor = "text-gray-500";
      
      if (currentCost > 0) {
        diffPct = ((currentCost - liveCpm) / liveCpm) * 100;
        if (diffPct < -5) { vsIcon = TrendingDown; vsColor = "text-emerald-500"; }
        else if (diffPct < 0) { vsIcon = TrendingDown; vsColor = "text-emerald-400"; }
        else if (diffPct < 10) { vsIcon = TrendingUp; vsColor = "text-amber-500"; }
        else { vsIcon = TrendingUp; vsColor = "text-red-500"; }
      }

      return {
        formatName,
        liveCpm,
        diffPct,
        vsIcon,
        vsColor,
        baseValue: liveCpm
      };
    }).filter(Boolean);
  }, [formatsData, category, currentCost]);

  // Generate chart data based on the first visible format
  const chartData = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    
    const sampleFormat = rows[0]!;
    const currentPrice = sampleFormat.baseValue;
    
    let nbPoints = 30;
    let maWindow = 7;
    if (timeRange === "Week -1") { nbPoints = 7; maWindow = 3; }
    else if (timeRange === "Months -6") { nbPoints = 180; maWindow = 30; }
    else if (timeRange === "Year -1") { nbPoints = 365; maWindow = 60; }

    const data = [];
    let price = currentPrice * 0.8; // Start lower
    
    for (let i = 0; i < nbPoints; i++) {
      const returnPct = (Math.random() - 0.45) * 0.03; // Slight upward bias
      price = price * (1 + returnPct);
      data.push({
        day: i,
        price: price,
        ma: 0 // calculated later
      });
    }

    // Calculate MA
    for (let i = 0; i < nbPoints; i++) {
      if (i >= maWindow - 1) {
        let sum = 0;
        for (let j = 0; j < maWindow; j++) {
          sum += data[i - j].price;
        }
        data[i].ma = sum / maWindow;
      } else {
        data[i].ma = data[i].price; // fallback
      }
    }

    // Force last price to match current
    const lastPoint = data[data.length - 1];
    const diff = currentPrice - lastPoint.price;
    for (let i = 0; i < nbPoints; i++) {
      data[i].price += diff * (i / nbPoints); // Smooth adjustment
    }

    return data;
  }, [rows, timeRange]);

  if (!rows || rows.length === 0) {
    return <div className="p-8 text-center text-gray-500 font-medium">Aucune donnée pour cette sélection.</div>;
  }

  const sampleFormat = rows[0]!;
  const currentPrice = sampleFormat.baseValue;
  const minPrice = Math.min(...chartData.map(d => d.price));
  const maxPrice = Math.max(...chartData.map(d => d.price));
  const priceChange = ((chartData[chartData.length - 1].price / chartData[0].price) - 1) * 100;

  return (
    <div className="p-8 h-full overflow-y-auto bg-[#f8f9fa]">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Market Watch</h2>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 grid grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">🌍 Pays</label>
            <select 
              className="w-full text-sm border-gray-200 bg-gray-50 rounded-xl p-3 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
              value={country} onChange={(e) => setCountry(e.target.value)}
            >
              <option>France</option>
              <option>Italie</option>
              <option>Belgique</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">📡 DSP</label>
            <select 
              className="w-full text-sm border-gray-200 bg-gray-50 rounded-xl p-3 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
              value={dsp} onChange={(e) => setDsp(e.target.value)}
            >
              <option>DV360 (Google)</option>
              <option>The Trade Desk (TTD)</option>
              <option>Amazon DSP</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">📦 Catégorie</label>
            <select 
              className="w-full text-sm border-gray-200 bg-gray-50 rounded-xl p-3 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
              value={category} onChange={(e) => setCategory(e.target.value)}
            >
              <option>Tous</option>
              <option>Display</option>
              <option>Video</option>
              <option>Native</option>
            </select>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 text-blue-800 px-5 py-4 rounded-xl text-sm font-medium flex items-center gap-3">
          <span className="text-xl">ℹ️</span> <strong>{dsp}</strong> : Fees DSP incluses (~{fees}%)
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-bold">Format</th>
                <th className="px-6 py-4 font-bold">CPM Cost (Net)</th>
                <th className="px-6 py-4 font-bold">vs Ton Cost ({currentCost.toFixed(2)} €)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, idx) => {
                if (!row) return null;
                const Icon = row.vsIcon;
                return (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-800">{row.formatName}</td>
                    <td className="px-6 py-4 text-gray-900 font-black text-lg">{row.liveCpm.toFixed(2)} €</td>
                    <td className="px-6 py-4">
                      {currentCost > 0 ? (
                        <div className={cn("flex items-center gap-1.5 font-bold", row.vsColor)}>
                          <Icon className="w-5 h-5" />
                          {row.diffPct > 0 ? "+" : ""}{row.diffPct.toFixed(1)}%
                        </div>
                      ) : (
                        <span className="text-gray-400 font-medium">N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Chart Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Évolution Historique</h3>
              <div className="text-sm font-medium text-gray-500 mt-1">{sampleFormat.formatName} - {country}</div>
            </div>
            <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-2">Période:</span>
              <select 
                className="text-sm border-none bg-transparent focus:ring-0 outline-none font-bold text-blue-600 cursor-pointer"
                value={timeRange} onChange={(e) => setTimeRange(e.target.value)}
              >
                <option>Week -1</option>
                <option>Month -1</option>
                <option>Months -6</option>
                <option>Year -1</option>
              </select>
            </div>
          </div>
          <div className="p-6">
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={false} axisLine={false} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val.toFixed(2)}€`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                    formatter={(value: number, name: string) => [`${value.toFixed(2)} €`, name === "price" ? "Prix" : "MA"]}
                    labelFormatter={() => ""}
                  />
                  <Area type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" />
                  <Area type="monotone" dataKey="ma" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-6">
          <MetricCard title="Prix Actuel" value={`${currentPrice.toFixed(2)} €`} />
          <MetricCard title="Plus Bas" value={`${minPrice.toFixed(2)} €`} subValue={`${((currentPrice/minPrice - 1)*100).toFixed(1)}%`} />
          <MetricCard title="Plus Haut" value={`${maxPrice.toFixed(2)} €`} subValue={`${((currentPrice/maxPrice - 1)*100).toFixed(1)}%`} />
          <MetricCard title="Volatilité (σ)" value={`${(maxPrice - minPrice).toFixed(2)} €`} />
        </div>

        {/* Advice */}
        <div className={cn(
          "p-6 rounded-2xl border flex items-start gap-5",
          priceChange > 5 ? "bg-amber-50 border-amber-100 text-amber-900" : 
          priceChange < -5 ? "bg-emerald-50 border-emerald-100 text-emerald-900" : 
          "bg-blue-50 border-blue-100 text-blue-900"
        )}>
          <div className="text-3xl mt-1 bg-white p-3 rounded-xl shadow-sm">
            {priceChange > 5 ? "📈" : priceChange < -5 ? "📉" : "⚖️"}
          </div>
          <div>
            <h4 className="font-black text-lg mb-2">Conseil Trader</h4>
            <p className="text-sm font-medium leading-relaxed opacity-90">
              {priceChange > 5 
                ? `Tendance Haussière (+${priceChange.toFixed(1)}%) : Le marché s'apprécie. Si tu as du budget restant, achète maintenant avant que ça monte encore.` 
                : priceChange < -5 
                ? `Tendance Baissière (${priceChange.toFixed(1)}%) : Le marché est en correction. Augmente ta marge ou attends encore pour acheter moins cher.` 
                : `Marché Stable (${priceChange > 0 ? '+' : ''}${priceChange.toFixed(1)}%) : Prix dans la fourchette normale. Continue ton trading habituel.`}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

function MetricCard({ title, value, subValue }: { title: string, value: string, subValue?: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</div>
      <div className="mt-3 flex items-baseline gap-3">
        <div className="text-3xl font-black text-gray-900">{value}</div>
        {subValue && <div className="text-sm font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-md">{subValue}</div>}
      </div>
    </div>
  );
}
