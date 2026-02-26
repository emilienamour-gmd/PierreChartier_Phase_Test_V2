import { ProjectData } from "../types";
import { cn } from "../utils/cn";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Trophy, TrendingUp, DollarSign, Percent } from "lucide-react";

interface PortfolioProps {
  projects: ProjectData[];
}

export function Portfolio({ projects }: PortfolioProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50 text-slate-500 p-8">
        <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
          <Trophy className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-700 mb-2">Aucun projet sauvegardé</h2>
        <p className="text-center max-w-md">
          Allez dans l'onglet <strong>Cockpit Yield</strong> pour créer et enregistrer votre premier projet.
        </p>
      </div>
    );
  }

  const portfolioData = projects.map(proj => {
    const currency = proj.currency.includes("EUR") ? "€" : "$";
    let marginPct = 0;
    if (proj.inputMode === "CPM Cost") {
      marginPct = proj.cpmRevenueActual > 0 ? ((proj.cpmRevenueActual - proj.cpmCostActuel) / proj.cpmRevenueActual) * 100 : 0;
    } else {
      marginPct = proj.margeInput;
    }

    const gainTotal = proj.budgetTotal * (marginPct / 100);
    const gainRealized = proj.budgetSpent * (marginPct / 100);

    return {
      name: proj.name || "Sans nom",
      budgetTotal: proj.budgetTotal,
      budgetSpent: proj.budgetSpent,
      marginPct,
      gainRealized,
      gainTotal,
      kpiType: proj.kpiType,
      kpiActual: proj.actualKpi,
      currency
    };
  });

  const totalBudget = portfolioData.reduce((acc, p) => acc + p.budgetTotal, 0);
  const totalGainRealized = portfolioData.reduce((acc, p) => acc + p.gainRealized, 0);
  const totalGainProjected = portfolioData.reduce((acc, p) => acc + p.gainTotal, 0);
  const avgMargin = portfolioData.reduce((acc, p) => acc + p.marginPct, 0) / portfolioData.length;

  const bestMarginProj = portfolioData.reduce((prev, current) => (prev.marginPct > current.marginPct) ? prev : current);
  const bestGainProj = portfolioData.reduce((prev, current) => (prev.gainTotal > current.gainTotal) ? prev : current);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // DEVISE PRINCIPALE (la plus commune)
  const mainCurrency = portfolioData.length > 0 ? portfolioData[0].currency : "€";

  return (
    <div className="p-8 bg-slate-50 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div>
          <h2 className="text-2xl font-bold text-slate-800">📊 Portfolio & Performance Globale</h2>
          <p className="text-slate-500 mt-1">Vue d'ensemble de tous vos projets sauvegardés</p>
        </div>

        {/* Global Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard title="Budget Total Géré" value={`${totalBudget.toLocaleString()} ${mainCurrency}`} icon={DollarSign} accent="blue" />
          {/* ✅ GAIN RÉALISÉ : Sans décimale */}
          <MetricCard title="Gain Déjà Réalisé" value={`${totalGainRealized.toFixed(0)} ${mainCurrency}`} icon={TrendingUp} accent="emerald" />
          <MetricCard title="Gain Total Projeté" value={`${totalGainProjected.toFixed(0)} ${mainCurrency}`} icon={Trophy} accent="amber" />
          <MetricCard title="Marge Moyenne" value={`${avgMargin.toFixed(2)} %`} icon={Percent} accent="purple" />
        </div>

        {/* Top Performers */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">🥇 Meilleure Marge</div>
              <div className="text-lg font-bold text-slate-800">{bestMarginProj.name}</div>
              <div className="text-sm text-emerald-600 font-medium">{bestMarginProj.marginPct.toFixed(2)} %</div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">💰 Plus Gros Gain</div>
              <div className="text-lg font-bold text-slate-800">{bestGainProj.name}</div>
              <div className="text-sm text-blue-600 font-medium">{bestGainProj.gainTotal.toFixed(0)} {bestGainProj.currency}</div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-6">
          {/* ✅ GRAPHIQUE AMÉLIORÉ : Devise visible + meilleure mise en forme */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6">Gains Projetés par Projet</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={portfolioData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis 
                    type="number" 
                    tick={{ fontSize: 12, fill: '#64748b' }} 
                    axisLine={false} 
                    tickLine={false}
                    tickFormatter={(val) => `${val.toLocaleString()} ${mainCurrency}`}
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    tick={{ fontSize: 12, fill: '#64748b' }} 
                    axisLine={false} 
                    tickLine={false} 
                    width={120} 
                  />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}} 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px', fontWeight: 'bold' }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value.toFixed(0)} ${props.payload.currency}`,
                      "Gain Total"
                    ]}
                    labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                  />
                  <Bar dataKey="gainTotal" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6">Répartition des Gains</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={portfolioData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="gainTotal"
                  >
                    {portfolioData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px', fontWeight: 'bold' }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value.toFixed(0)} ${props.payload.currency}`,
                      props.payload.name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">📋 Détail par Projet</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Projet</th>
                  <th className="px-6 py-4 font-medium">Budget Total</th>
                  <th className="px-6 py-4 font-medium">Dépensé</th>
                  <th className="px-6 py-4 font-medium">Marge %</th>
                  <th className="px-6 py-4 font-medium">Gain Réalisé</th>
                  <th className="px-6 py-4 font-medium">Gain Projeté</th>
                  <th className="px-6 py-4 font-medium">KPI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {portfolioData.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">{p.name}</td>
                    <td className="px-6 py-4 text-slate-600">{p.budgetTotal.toLocaleString()} {p.currency}</td>
                    <td className="px-6 py-4 text-slate-600">{p.budgetSpent.toLocaleString()} {p.currency}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{p.marginPct.toFixed(2)} %</td>
                    <td className="px-6 py-4 text-emerald-600 font-medium">{p.gainRealized.toFixed(0)} {p.currency}</td>
                    <td className="px-6 py-4 text-emerald-600 font-bold">{p.gainTotal.toFixed(0)} {p.currency}</td>
                    <td className="px-6 py-4 text-slate-600">{p.kpiType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, accent }: { title: string, value: string, icon: any, accent: "blue" | "emerald" | "amber" | "purple" }) {
  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={cn(
        "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
        accent === "blue" && "bg-blue-100 text-blue-600",
        accent === "emerald" && "bg-emerald-100 text-emerald-600",
        accent === "amber" && "bg-amber-100 text-amber-600",
        accent === "purple" && "bg-purple-100 text-purple-600"
      )}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</div>
        <div className="text-2xl font-black text-slate-800 mt-1">{value}</div>
      </div>
    </div>
  );
}
