"use client";

import { useState } from "react";
import { resetQuotaAction, triggerWebhookMultiple, generateBulkLeads } from "@/actions/leads";

interface ResultLog {
  id: number;
  label: string;
  data: unknown;
  ts: string;
}

export default function TestToolsPage() {
  const [logs, setLogs] = useState<ResultLog[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  function addLog(label: string, data: unknown) {
    setLogs((prev) => [
      { id: Date.now(), label, data, ts: new Date().toLocaleTimeString() },
      ...prev,
    ]);
  }

  async function runAction(key: string, label: string, fn: () => Promise<unknown>) {
    setLoading(key);
    try {
      const result = await fn();
      addLog(label, result);
    } catch (err) {
      addLog(label, { error: String(err) });
    } finally {
      setLoading(null);
    }
  }

  const tools = [
    {
      key: "reset",
      label: "Reset All Provider Quotas",
      description: "Sends a unique webhook event to reset usedQuota to 0 for all providers.",
      color: "bg-yellow-600 hover:bg-yellow-500",
      action: () => resetQuotaAction(),
    },
    {
      key: "webhook",
      label: "Trigger Webhook × 3 (Same Event ID)",
      description:
        "Fires the reset-quota webhook 3 times with the same eventId to verify idempotency. Only the first call should have effect.",
      color: "bg-purple-600 hover:bg-purple-500",
      action: () => triggerWebhookMultiple(3),
    },
    {
      key: "bulk",
      label: "Generate 10 Leads Concurrently",
      description:
        "Creates 10 leads simultaneously across all services to stress-test the concurrency-safe allocation algorithm.",
      color: "bg-blue-600 hover:bg-blue-500",
      action: () => generateBulkLeads(10),
    },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Test Tools</h1>
        <p className="text-gray-400 text-sm mt-1">
          Utilities to test allocation, concurrency, and webhook idempotency.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {tools.map((tool) => (
          <div
            key={tool.key}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-5"
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm">{tool.label}</p>
              <p className="text-gray-400 text-xs mt-0.5">{tool.description}</p>
            </div>
            <button
              onClick={() => runAction(tool.key, tool.label, tool.action)}
              disabled={loading !== null}
              className={`${tool.color} shrink-0 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm`}
            >
              {loading === tool.key ? "Running..." : "Run"}
            </button>
          </div>
        ))}
      </div>

      {/* Result logs */}
      {logs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wider">
              Result Log
            </h2>
            <button
              onClick={() => setLogs([])}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Clear
            </button>
          </div>
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{log.label}</span>
                  <span className="text-xs text-gray-500">{log.ts}</span>
                </div>
                <pre className="text-xs text-gray-300 bg-gray-950 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
