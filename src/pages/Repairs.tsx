import { useState } from "react";

type Repair = {
  customer: string;
  phone: string;
  imei: string;
  issue: string;
  technician: string;
  cost: number;
  status: string;
};

export default function Repairs() {
  const [repairs, setRepairs] = useState<Repair[]>([]);

  const [form, setForm] = useState({
    customer: "",
    phone: "",
    imei: "",
    issue: "",
    technician: "",
    cost: "",
    status: "Pending",
  });

  function addRepair() {
    if (!form.customer || !form.phone || !form.issue) return;

    setRepairs((prev) => [
      ...prev,
      {
        customer: form.customer,
        phone: form.phone,
        imei: form.imei,
        issue: form.issue,
        technician: form.technician,
        cost: Number(form.cost || 0),
        status: form.status,
      },
    ]);

    setForm({
      customer: "",
      phone: "",
      imei: "",
      issue: "",
      technician: "",
      cost: "",
      status: "Pending",
    });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Repairs Intake</h2>

      {/* Form */}
      <div className="bg-white p-4 rounded shadow grid grid-cols-3 gap-4">
        <input
          className="border p-2 rounded"
          placeholder="Customer Name"
          value={form.customer}
          onChange={(e) => setForm({ ...form, customer: e.target.value })}
        />

        <input
          className="border p-2 rounded"
          placeholder="Phone Model"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />

        <input
          className="border p-2 rounded"
          placeholder="IMEI"
          value={form.imei}
          onChange={(e) => setForm({ ...form, imei: e.target.value })}
        />

        <input
          className="border p-2 rounded col-span-2"
          placeholder="Problem / Issue"
          value={form.issue}
          onChange={(e) => setForm({ ...form, issue: e.target.value })}
        />

        <input
          className="border p-2 rounded"
          placeholder="Technician"
          value={form.technician}
          onChange={(e) =>
            setForm({ ...form, technician: e.target.value })
          }
        />

        <input
          className="border p-2 rounded"
          placeholder="Repair Cost"
          type="number"
          value={form.cost}
          onChange={(e) => setForm({ ...form, cost: e.target.value })}
        />

        <select
          className="border p-2 rounded"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
        >
          <option>Pending</option>
          <option>In Progress</option>
          <option>Completed</option>
        </select>

        <button
          onClick={addRepair}
          className="bg-green-600 text-white rounded px-4 col-span-3"
        >
          Add Repair
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">Customer</th>
              <th className="p-3">Phone</th>
              <th className="p-3">IMEI</th>
              <th className="p-3">Issue</th>
              <th className="p-3">Tech</th>
              <th className="p-3">Cost</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {repairs.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  No repairs added
                </td>
              </tr>
            )}

            {repairs.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-3">{r.customer}</td>
                <td className="p-3">{r.phone}</td>
                <td className="p-3">{r.imei}</td>
                <td className="p-3">{r.issue}</td>
                <td className="p-3">{r.technician}</td>
                <td className="p-3">KES {r.cost}</td>
                <td className="p-3">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
