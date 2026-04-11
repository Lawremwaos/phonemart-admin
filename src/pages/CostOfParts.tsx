import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useRepair } from "../context/RepairContext";
import { useShop } from "../context/ShopContext";
import { getOutsourcedItemsNeedingCostForRepair } from "../utils/repairOutsourcedCost";

export default function CostOfParts() {
  const { repairs, updatePartCost } = useRepair();
  const { currentUser } = useShop();
  const [searchTerm, setSearchTerm] = useState("");
  const [costInputs, setCostInputs] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  // Repairs that have outsourced parts needing cost input
  const repairsNeedingCosts = useMemo(() => {
    let filtered = repairs;

    if (!currentUser?.roles.includes('admin') && currentUser?.shopId) {
      filtered = filtered.filter(repair => repair.shopId === currentUser.shopId);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(repair =>
        repair.customerName.toLowerCase().includes(term) ||
        repair.phoneNumber.includes(term) ||
        repair.phoneModel.toLowerCase().includes(term) ||
        repair.ticketNumber?.toLowerCase().includes(term)
      );
    }

    return filtered.filter(repair => {
      const outsourcedItems = getOutsourcedItemsNeedingCostForRepair(repair);
      return outsourcedItems.length > 0;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [repairs, currentUser, searchTerm]);

  // Repairs with costs already entered (for reference)
  const repairsWithCosts = useMemo(() => {
    let filtered = repairs;

    if (!currentUser?.roles.includes('admin') && currentUser?.shopId) {
      filtered = filtered.filter(repair => repair.shopId === currentUser.shopId);
    }

    return filtered.filter(repair => {
      const hasOutsourcedParts = repair.additionalItems?.some(i => i.source === 'outsourced') ||
        repair.partsUsed.some(p => p.cost > 0);
      const allCostsFilled = getOutsourcedItemsNeedingCostForRepair(repair).length === 0;
      return hasOutsourcedParts && allCostsFilled;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
  }, [repairs, currentUser]);

  const handleSaveCost = async (repairId: string, itemName: string, qty: number) => {
    const key = `${repairId}-${itemName}`;
    const costValue = costInputs[key];
    const costPerUnit = Number(costValue);
    if (!costValue || costPerUnit <= 0) {
      alert("Please enter a valid cost");
      return;
    }

    setSavingKeys(prev => new Set(prev).add(key));

    try {
      await updatePartCost(repairId, itemName, costPerUnit, qty);
      setCostInputs(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    } catch (err) {
      console.error("Error saving cost:", err);
      alert("Failed to save cost. Please try again.");
    } finally {
      setSavingKeys(prev => {
        const updated = new Set(prev);
        updated.delete(key);
        return updated;
      });
    }
  };

  const handleCostInputChange = (key: string, value: string) => {
    setCostInputs(prev => ({ ...prev, [key]: value }));
  };

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const getStatusLabel = (repair: typeof repairs[0]) => {
    if (repair.status === 'COLLECTED') return { text: 'Collected', color: 'bg-green-100 text-green-800' };
    if (repair.paymentStatus === 'fully_paid') return { text: 'Fully Paid', color: 'bg-blue-100 text-blue-800' };
    if (repair.paymentStatus === 'partial') return { text: 'Partial Payment', color: 'bg-yellow-100 text-yellow-800' };
    return { text: 'Pending', color: 'bg-gray-100 text-gray-800' };
  };

  return (
    <div className="p-6">
      <div className="pm-page-head mb-4">
        <h1 className="text-3xl font-bold text-[var(--pm-ink)] mb-2">Cost of Parts</h1>
        <p className="text-gray-600">
          Enter the actual cost of outsourced parts used in repairs. After admin approves payment and the repair is back with staff for collection, fill costs here so profit is calculated and the daily report can be sent.
        </p>
      </div>

      {/* Repair sale workflow */}
      <div className="pm-card pm-pad mb-6">
        <h3 className="font-semibold text-indigo-900 mb-2">Repair sale workflow</h3>
        <ol className="list-decimal list-inside text-sm text-indigo-800 space-y-1">
          <li>Staff fills in customer details and completes repair sale, assigns a ticket.</li>
          <li>Repair goes to admin for payment approval.</li>
          <li>After approval, sent back to staff for collection.</li>
          <li><strong>Here:</strong> Staff fills in the cost of each outsourced item (form below).</li>
          <li>System records everything and calculates profit.</li>
          <li>Staff can send the report via WhatsApp / Email from <Link to="/repair-report" className="underline font-semibold">Repair Report</Link> or <Link to="/accessories-report" className="underline font-semibold">Accessories Report</Link>.</li>
        </ol>
      </div>

      <div className="pm-card pm-pad mb-6">
        <label className="pm-label">Search Repairs</label>
        <input
          type="text"
          className="pm-input"
          placeholder="Search by customer name, phone, model, or ticket number"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="pm-card pm-pad mb-4">
        <p className="text-sm text-blue-800">
          Showing <span className="font-semibold">{repairsNeedingCosts.length}</span> repair(s) with outsourced parts needing cost input
        </p>
      </div>

      {/* Repairs needing cost input - form is always visible */}
      <div className="space-y-4 mb-8">
        <h2 className="text-xl font-semibold text-gray-800">Enter cost of outsourced items</h2>
        {repairsNeedingCosts.length === 0 ? (
          <div className="pm-card pm-pad-xl border border-slate-200 text-center text-slate-600">
            <p className="text-lg font-medium mb-2">No repairs needing cost input right now</p>
            <p className="text-sm mb-4">All outsourced part costs have been entered, or there are no repairs with outsourced parts.</p>
            <p className="text-sm mb-2">When you complete a repair sale with outsourced parts, the repair will appear here so you can enter each part’s cost.</p>
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              <Link to="/repair-sales" className="pm-btn pm-btn-primary text-sm">Repair Sale</Link>
              <Link to="/pending-collections" className="pm-btn pm-btn-secondary text-sm">Pending Collections</Link>
              <Link to="/repair-report" className="pm-btn pm-btn-success text-sm">Repair Report</Link>
              <Link to="/accessories-report" className="pm-btn pm-btn-success text-sm">Accessories Report</Link>
            </div>
          </div>
        ) : (
          repairsNeedingCosts.map((repair) => {
            const outsourcedItems = getOutsourcedItemsNeedingCostForRepair(repair);
            const status = getStatusLabel(repair);
            return (
              <div key={repair.id} className="pm-card overflow-hidden">
                <div className="bg-[var(--pm-subtle)] px-6 py-4 border-b border-[var(--pm-border)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {repair.customerName} - {repair.phoneModel}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {repair.phoneNumber} | {formatDate(repair.date)}
                        {repair.ticketNumber && <> | Ticket: <span className="font-mono">{repair.ticketNumber}</span></>}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Staff: <span className="font-medium text-indigo-700">{repair.technician || 'Unknown'}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}>
                        {status.text}
                      </span>
                      <span className="text-sm text-gray-500">
                        Total: KES {(repair.totalAgreedAmount || repair.totalCost).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Issue: {repair.issue}</p>
                </div>

                <div className="px-6 py-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Outsourced Parts - Enter Cost:</h4>
                  <div className="space-y-3">
                    {outsourcedItems.map((item) => {
                      const key = `${repair.id}-${item.itemName}`;
                      const isSaving = savingKeys.has(key);
                      return (
                        <div key={key} className="flex flex-wrap items-center gap-3 p-3 rounded border bg-orange-50 border-orange-200">
                          <div className="flex-1 min-w-[200px]">
                            <p className="font-medium text-gray-900">{item.itemName}</p>
                            <p className="text-xs text-gray-600">
                              Qty: {item.qty}
                              {item.supplierName && <> | Supplier: <span className="font-medium text-orange-700">{item.supplierName}</span></>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              placeholder="Cost per unit"
                              value={costInputs[key] || ''}
                              onChange={(e) => handleCostInputChange(key, e.target.value)}
                              className="pm-input w-36 text-sm"
                              min="0"
                              step="1"
                              disabled={isSaving}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveCost(repair.id, item.itemName, item.qty);
                              }}
                            />
                            <button
                              onClick={() => handleSaveCost(repair.id, item.itemName, item.qty)}
                              disabled={isSaving}
                              className={`pm-btn pm-btn-success text-sm ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
                            >
                              {isSaving ? 'Saving...' : 'Save Cost'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Recently completed costs */}
      {repairsWithCosts.length > 0 && (
        <div className="pm-card pm-pad-lg">
          <h3 className="text-lg font-semibold mb-4">Recently Completed Cost Entries</h3>
          <div className="pm-table-shell overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Staff</th>
                  <th className="p-2 text-left">Customer</th>
                  <th className="p-2 text-left">Phone</th>
                  <th className="p-2 text-left">Parts & Costs</th>
                  <th className="p-2 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {repairsWithCosts.map(repair => {
                  const partsCost = repair.partsUsed.reduce((s, p) => s + (p.cost * p.qty), 0);
                  return (
                    <tr key={repair.id} className="border-t hover:bg-gray-50">
                      <td className="p-2">{new Date(repair.date).toLocaleDateString()}</td>
                      <td className="p-2">
                        <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded font-medium">
                          {repair.technician || 'Unknown'}
                        </span>
                      </td>
                      <td className="p-2 font-medium">{repair.customerName}</td>
                      <td className="p-2">{repair.phoneModel}</td>
                      <td className="p-2">
                        {repair.partsUsed.filter(p => p.cost > 0).map((p, i) => (
                          <span key={i} className="inline-block bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded mr-1 mb-1">
                            {p.itemName}: KES {p.cost.toLocaleString()} x{p.qty}
                            {p.supplierName && ` (${p.supplierName})`}
                          </span>
                        ))}
                      </td>
                      <td className="p-2 text-right font-bold text-red-600">KES {partsCost.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="pm-card pm-pad mt-6">
        <h3 className="font-semibold text-blue-900 mb-2">How it Works:</h3>
        <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
          <li>After completing a repair sale with outsourced parts, the repair appears here</li>
          <li>Enter the actual cost per unit for each outsourced part</li>
          <li>Click "Save Cost" - the cost is saved to the database permanently</li>
          <li>After saving, the repair moves to "Recently Completed" and the cost is used everywhere for profit calculations</li>
          <li>Costs persist even after page refresh or re-login</li>
        </ol>
      </div>
    </div>
  );
}
