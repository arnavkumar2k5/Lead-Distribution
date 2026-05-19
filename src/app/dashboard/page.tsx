"use client";

import { useState, useEffect, useCallback } from "react";
import { useRealtime } from "@/hooks/useRealtime";

interface ProviderLead {
  assignmentId: number;
  leadId: number;
  leadName: string;
  city: string;
  serviceName: string;
  phone: string;
  assignedAt: string;
}

interface Provider {
  id: number;
  name: string;
  monthlyQuota: number;
  usedQuota: number;
  remainingQuota: number;
  leadsCount: number;
  leads: ProviderLead[];
}

export default function DashboardPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<number | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/providers");
      const data = await res.json();
      setProviders(data.providers ?? []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch providers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useRealtime({
    onLeadAssigned: (data: unknown) => {
      const d = data as { serviceName: string; assignedProviders: string[] };
      fetchProviders();
      setFlashMessage(
        `New lead assigned (${d.serviceName}) → ${d.assignedProviders.join(", ")}`
      );
      setTimeout(() => setFlashMessage(null), 5000);
    },
    onQuotaReset: () => {
      fetchProviders();
      setFlashMessage("All provider quotas have been reset.");
      setTimeout(() => setFlashMessage(null), 5000);
    },
  });

  const totalLeads = providers.reduce((sum, p) => sum + p.leadsCount, 0);
  const fullQuotaCount = providers.filter((p) => p.remainingQuota === 0).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Provider Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            Live lead distribution across all providers
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
          Live
          {lastUpdated && (
            <span className="ml-1">· Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {flashMessage && (
        <div className="mb-6 p-3 bg-blue-900/40 border border-blue-700 rounded-lg text-blue-300 text-sm">
          🔔 {flashMessage}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Providers" value={providers.length} />
        <StatCard label="Total Leads Assigned" value={totalLeads} />
        <StatCard label="Providers at Full Quota" value={fullQuotaCount} accent={fullQuotaCount > 0} />
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading providers...</div>
      ) : (
        <div className="space-y-3">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              expanded={expandedProvider === provider.id}
              onToggle={() =>
                setExpandedProvider(
                  expandedProvider === provider.id ? null : provider.id
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent ? "text-red-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function ProviderCard({
  provider,
  expanded,
  onToggle,
}: {
  provider: Provider;
  expanded: boolean;
  onToggle: () => void;
}) {
  const pct = Math.round((provider.usedQuota / provider.monthlyQuota) * 100);
  const quotaColor =
    pct >= 100 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={onToggle}
      >
        <div className="w-28 shrink-0">
          <span className="font-semibold text-white text-sm">{provider.name}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Quota used</span>
            <span className="text-xs text-gray-300">
              {provider.usedQuota} / {provider.monthlyQuota}
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div
              className={`${quotaColor} h-1.5 rounded-full transition-all`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-6 shrink-0 text-sm">
          <div className="text-center">
            <p className="text-gray-400 text-xs">Remaining</p>
            <p className="font-semibold text-white">{provider.remainingQuota}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-xs">Leads</p>
            <p className="font-semibold text-white">{provider.leadsCount}</p>
          </div>
        </div>

        <div className="shrink-0">
          {provider.remainingQuota === 0 ? (
            <span className="text-xs bg-red-900/50 text-red-400 border border-red-800 px-2 py-0.5 rounded-full">
              Full
            </span>
          ) : (
            <span className="text-xs bg-green-900/50 text-green-400 border border-green-800 px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </div>

        <div className="text-gray-500 text-xs shrink-0">
          {provider.leadsCount > 0 && (expanded ? "▲" : "▼")}
        </div>
      </div>

      {expanded && provider.leads.length > 0 && (
        <div className="border-t border-gray-800 p-4">
          <p className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">
            Assigned Leads
          </p>
          <div className="space-y-2">
            {provider.leads.map((lead) => (
              <div
                key={lead.assignmentId}
                className="flex items-center gap-4 text-sm bg-gray-800/50 rounded-lg px-3 py-2"
              >
                <span className="text-gray-500 font-mono text-xs w-12">
                  #{lead.leadId}
                </span>
                <span className="text-white font-medium flex-1">{lead.leadName}</span>
                <span className="text-gray-400">{lead.city}</span>
                <span className="text-xs bg-blue-900/40 text-blue-300 border border-blue-800 px-2 py-0.5 rounded">
                  {lead.serviceName}
                </span>
                <span className="text-gray-500 text-xs">
                  {new Date(lead.assignedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
