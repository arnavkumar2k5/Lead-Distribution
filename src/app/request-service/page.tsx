"use client";

import { useState } from "react";
import { submitLead } from "@/actions/leads";

interface Service {
  id: number;
  name: string;
}

export default function RequestServicePage() {
  const [services] = useState<Service[]>([
    { id: 1, name: "Service 1" },
    { id: 2, name: "Service 2" },
    { id: 3, name: "Service 3" },
  ]);
  const [result, setResult] = useState<{
    success: boolean;
    error?: string;
    assignedProviders?: string[];
    leadId?: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const formData = new FormData(e.currentTarget);
    const res = await submitLead(formData);
    setResult(res);
    setLoading(false);
    if (res.success) {
      (e.target as HTMLFormElement).reset();
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Request a Service</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Submit your details and we'll connect you with the right providers.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Full Name" name="name" type="text" placeholder="John Doe" required />
          <Field label="Phone Number" name="phone" type="tel" placeholder="+91 98765 43210" required />
          <Field label="City" name="city" type="text" placeholder="Mumbai" required />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Service Type
            </label>
            <select
              name="serviceId"
              required
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a service</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Description
            </label>
            <textarea
              name="description"
              required
              rows={4}
              placeholder="Describe what you need..."
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? "Submitting..." : "Submit Request"}
          </button>
        </form>

        {result && (
          <div
            className={`mt-5 p-4 rounded-lg border text-sm ${
              result.success
                ? "bg-green-900/30 border-green-700 text-green-300"
                : "bg-red-900/30 border-red-700 text-red-300"
            }`}
          >
            {result.success ? (
              <div>
                <p className="font-semibold mb-2">✅ Request submitted successfully!</p>
                <p className="text-gray-300 mb-1">Lead ID: #{result.leadId}</p>
                <p className="text-gray-300 mb-1">Assigned to:</p>
                <ul className="list-disc list-inside text-gray-200">
                  {result.assignedProviders?.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p>❌ {result.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        required={required}
        className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
