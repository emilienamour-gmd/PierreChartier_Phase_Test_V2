import { useState } from "react";
import { ProjectData, DailyEntry, ProjectSnapshot } from "../types";
import { Calendar, TrendingUp, DollarSign, Percent, Target, Save, AlertCircle } from "lucide-react";
import { cn } from "../utils/cn";

interface CampaignTrackingProps {
  project: ProjectData;
  onChange: (project: ProjectData) => void;
}

export function CampaignTracking({ project, onChange }: CampaignTrackingProps) {
  const currSym = project.currency.includes("EUR") ? "€" : "$";
  const today = new Date().toISOString().split('T')[0];
  
  // État du formulaire
  const [formData, setFormData] = useState<DailyEntry>({
    date: today,
    budgetSpent: 0,
    cpmRevenue: project.cpmRevenueActual,
    marginPct: project.margeInput,
    kpiActual: project.actualKpi,
  });

  // Vérifier si une entrée existe déjà pour aujourd'hui
  const todayEntry = project.dailyEntries?.find(e => e.date === today);
  const hasEntryToday = !!todayEntry;

  // Calculer le budget cumulé
  const cumulativeBudget = (project.dailyEntries || [])
    .reduce((sum, entry) => sum + entry.budgetSpent, 0);

  const handleInputChange = (field: keyof DailyEntry, value: number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!project.id) {
      alert("⚠️ Vous devez d'abord sauvegarder votre campagne avant d'ajouter des données quotidiennes.");
      return;
    }

    if (formData.budgetSpent <= 0) {
      alert("⚠️ Le budget dépensé doit être supérieur à 0.");
      return;
    }

    // Créer une nouvelle entrée quotidienne
    const newEntry: DailyEntry = {
      ...formData,
      date: formData.date,
    };

    // Mettre à jour ou ajouter l'entrée
    let updatedEntries = [...(project.dailyEntries || [])];
    const existingIndex = updatedEntries.findIndex(e => e.date === formData.date);
    
    if (existingIndex >= 0) {
      updatedEntries[existingIndex] = newEntry;
    } else {
      updatedEntries.push(newEntry);
    }

    // Trier par date (plus récent en premier)
    updatedEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculer le nouveau budget total dépensé
    const newTotalBudgetSpent = updatedEntries.reduce((sum, e) => sum + e.budgetSpent, 0);

    // Créer un snapshot pour l'historique
    const snapshot: ProjectSnapshot = {
      timestamp: new Date(formData.date + 'T12:00:00').toISOString(),
      budgetSpent: newTotalBudgetSpent,
      marginPct: formData.marginPct,
      cpmCostActuel: formData.cpmRevenue * (1 - formData.marginPct / 100),
      cpmRevenueActual: formData.cpmRevenue,
      actualKpi: formData.kpiActual,
      gainRealized: newTotalBudgetSpent * (formData.marginPct / 100),
      action: "DAILY_UPDATE",
      note: `Suivi quotidien : ${new Date(formData.date).toLocaleDateString('fr-FR')}`
    };

    // Mettre à jour le projet
    onChange({
      ...project,
      dailyEntries: updatedEntries,
      budgetSpent: newTotalBudgetSpent,
      cpmRevenueActual: formData.cpmRevenue,
      actualKpi: formData.kpiActual,
      margeInput: formData.marginPct,
      history: [...(project.history || []), snapshot],
      updatedAt: new Date().toISOString()
    });

    alert(`✅ Données du ${new Date(formData.date).toLocaleDateString('fr-FR')} enregistrées !`);
    
    // Reset le formulaire pour demain
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFormData({
      date: tomorrow.toISOString().split('T')[0],
      budgetSpent: 0,
      cpmRevenue: formData.cpmRevenue,
      marginPct: formData.marginPct,
      kpiActual: formData.kpiActual,
    });
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-[#f8f9fa]">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">📊 Suivi Quotidien Campagne</h2>
            <p className="text-gray-500 mt-1">Enregistrez vos performances jour après jour</p>
          </div>
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-6 py-3 shadow-sm">
            <Calendar className="w-5 h-5 text-blue-600" />
            <div>
              <div className="text-xs text-gray-500 font-medium">Entrées enregistrées</div>
              <div className="text-2xl font-black text-gray-900">{project.dailyEntries?.length || 0}</div>
            </div>
          </div>
        </div>

        {/* Alert si pas sauvegardé */}
        {!project.id && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-900 mb-1">Campagne non sauvegardée</h4>
              <p className="text-sm text-amber-700">
                Vous devez d'abord sauvegarder votre campagne (bouton "Sauvegarder" dans la sidebar) avant de pouvoir enregistrer des données quotidiennes.
              </p>
            </div>
          </div>
        )}

        {/* Résumé Cumulé */}
        <div className="grid grid-cols-4 gap-6">
          <MetricCard 
            title="Budget Cumulé" 
            value={`${cumulativeBudget.toFixed(0)} ${currSym}`}
            icon={DollarSign}
            color="blue"
          />
          <MetricCard 
            title="Jours Trackés" 
            value={`${project.dailyEntries?.length || 0}`}
            icon={Calendar}
            color="emerald"
          />
          <MetricCard 
            title="Marge Moyenne" 
            value={`${project.dailyEntries?.length ? (project.dailyEntries.reduce((sum, e) => sum + e.marginPct, 0) / project.dailyEntries.length).toFixed(2) : '0.00'} %`}
            icon={Percent}
            color="purple"
          />
          <MetricCard 
            title={`${project.kpiType} Moyen`} 
            value={`${project.dailyEntries?.length ? (project.dailyEntries.reduce((sum, e) => sum + e.kpiActual, 0) / project.dailyEntries.length).toFixed(2) : '0.00'}`}
            icon={Target}
            color="amber"
          />
        </div>

        {/* Formulaire de Saisie */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 p-6">
            <h3 className="text-lg font-bold text-blue-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                <Calendar className="w-6 h-6" />
              </div>
              Saisir les Données du Jour
            </h3>
            <p className="text-sm text-blue-700 mt-2">
              Remplissez vos performances de la veille pour mettre à jour automatiquement votre campagne
            </p>
          </div>

          <div className="p-8 space-y-6">
            {/* Date */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                📅 Date
              </label>
              <input 
                type="date"
                className="w-full text-base border-gray-300 bg-gray-50 rounded-xl p-4 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                max={today}
              />
              {hasEntryToday && (
                <p className="text-xs text-amber-600 mt-2 font-medium">
                  ⚠️ Une entrée existe déjà pour cette date. La sauvegarder écrasera l'ancienne.
                </p>
              )}
            </div>

            {/* Grille de saisie */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                  💰 Budget Dépensé ({currSym})
                </label>
                <input 
                  type="number"
                  step="0.01"
                  className="w-full text-base border-gray-300 bg-gray-50 rounded-xl p-4 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
                  value={formData.budgetSpent}
                  onChange={(e) => handleInputChange("budgetSpent", Number(e.target.value))}
                  placeholder="Ex: 1500.00"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                  📈 CPM Revenu ({currSym})
                </label>
                <input 
                  type="number"
                  step="0.01"
                  className="w-full text-base border-gray-300 bg-gray-50 rounded-xl p-4 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
                  value={formData.cpmRevenue}
                  onChange={(e) => handleInputChange("cpmRevenue", Number(e.target.value))}
                  placeholder="Ex: 8.50"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                  📊 Marge (%)
                </label>
                <input 
                  type="number"
                  step="0.5"
                  className="w-full text-base border-gray-300 bg-gray-50 rounded-xl p-4 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
                  value={formData.marginPct}
                  onChange={(e) => handleInputChange("marginPct", Number(e.target.value))}
                  placeholder="Ex: 22.5"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                  🎯 {project.kpiType} Actuel
                </label>
                <input 
                  type="number"
                  step="0.01"
                  className="w-full text-base border-gray-300 bg-gray-50 rounded-xl p-4 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
                  value={formData.kpiActual}
                  onChange={(e) => handleInputChange("kpiActual", Number(e.target.value))}
                  placeholder="Ex: 0.45"
                />
              </div>
            </div>

            {/* Preview Calculs */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
              <h4 className="text-sm font-bold text-blue-900 mb-4 uppercase tracking-wider">📐 Calculs Automatiques</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1 font-medium">CPM Cost</div>
                  <div className="text-xl font-black text-gray-900">
                    {(formData.cpmRevenue * (1 - formData.marginPct / 100)).toFixed(2)} {currSym}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1 font-medium">Gain du Jour</div>
                  <div className="text-xl font-black text-emerald-600">
                    {(formData.budgetSpent * (formData.marginPct / 100)).toFixed(2)} {currSym}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1 font-medium">Nouveau Cumulé</div>
                  <div className="text-xl font-black text-blue-600">
                    {(cumulativeBudget + formData.budgetSpent).toFixed(0)} {currSym}
                  </div>
                </div>
              </div>
            </div>

            {/* Bouton Sauvegarder */}
            <div className="flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={!project.id || formData.budgetSpent <= 0}
                className={cn(
                  "flex items-center gap-3 px-8 py-4 rounded-xl text-base font-bold transition-all shadow-lg",
                  (!project.id || formData.budgetSpent <= 0)
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105"
                )}
              >
                <Save className="w-5 h-5" />
                Enregistrer les Données
              </button>
            </div>
          </div>
        </div>

        {/* Historique des Entrées */}
        {project.dailyEntries && project.dailyEntries.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900">📋 Historique des Saisies</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Budget Dépensé</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">CPM Revenu</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Marge %</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{project.kpiType}</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Gain</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {project.dailyEntries.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {new Date(entry.date).toLocaleDateString('fr-FR', { 
                          weekday: 'short', 
                          day: '2-digit', 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {entry.budgetSpent.toFixed(2)} {currSym}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {entry.cpmRevenue.toFixed(2)} {currSym}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          {entry.marginPct.toFixed(2)} %
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium">
                        {entry.kpiActual.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-emerald-600 font-bold">
                          +{(entry.budgetSpent * (entry.marginPct / 100)).toFixed(2)} {currSym}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color }: { 
  title: string; 
  value: string; 
  icon: any; 
  color: "blue" | "emerald" | "purple" | "amber";
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</div>
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          color === "blue" && "bg-blue-100 text-blue-600",
          color === "emerald" && "bg-emerald-100 text-emerald-600",
          color === "purple" && "bg-purple-100 text-purple-600",
          color === "amber" && "bg-amber-100 text-amber-600"
        )}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-3xl font-black text-gray-900">{value}</div>
    </div>
  );
}
