import React, { useState, useMemo } from "react";
import { useRepair } from "../context/RepairContext";
import { useSales } from "../context/SalesContext";
import { useShop } from "../context/ShopContext";
import Receipt from "../components/Receipt";
import { downloadReceiptAsPDF, formatReceiptText, shareViaWhatsApp } from "../utils/receiptUtils";

export default function AdminCustomerManagement() {
  const { repairs, deleteRepair } = useRepair();
  const { sales, deleteSale } = useSales();
  const { currentUser, currentShop } = useShop();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'repairs' | 'sales'>('all');
  const [selectedRepair, setSelectedRepair] = useState<typeof repairs[0] | null>(null);
  const [selectedSale, setSelectedSale] = useState<typeof sales[0] | null>(null);
  const receiptRef = React.useRef<HTMLDivElement>(null);

  // Admin only
  if (!currentUser || !currentUser.roles.includes('admin')) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Access Denied</p>
          <p>Only administrators can access this page.</p>
        </div>
      </div>
    );
  }

  // Filter repairs and sales by search term
  const filteredRepairs = useMemo(() => {
    if (filterType === 'sales') return [];
    const term = searchTerm.toLowerCase();
    return repairs.filter(repair =>
      repair.customerName.toLowerCase().includes(term) ||
      repair.phoneNumber.includes(term) ||
      repair.phoneModel.toLowerCase().includes(term) ||
      repair.id.includes(term)
    );
  }, [repairs, searchTerm, filterType]);

  const filteredSales = useMemo(() => {
    if (filterType === 'repairs') return [];
    const term = searchTerm.toLowerCase();
    return sales.filter(sale =>
      sale.id.includes(term) ||
      sale.items.some(item => item.name.toLowerCase().includes(term))
    );
  }, [sales, searchTerm, filterType]);

  const handleReprintRepair = (repair: typeof repairs[0]) => {
    setSelectedRepair(repair);
    setSelectedSale(null);
  };

  const handleReprintSale = (sale: typeof sales[0]) => {
    setSelectedSale(sale);
    setSelectedRepair(null);
  };

  const handleDeleteRepair = (repairId: string, customerName: string) => {
    if (!window.confirm(`Are you sure you want to delete repair record for ${customerName}? This action cannot be undone.`)) {
      return;
    }
    deleteRepair(repairId);
    alert('Repair record deleted successfully.');
  };

  const handleDeleteSale = (saleId: string) => {
    if (!window.confirm(`Are you sure you want to delete this sale record? This action cannot be undone.`)) {
      return;
    }
    deleteSale(saleId);
    alert('Sale record deleted successfully.');
  };

  const handleDownloadPDF = async () => {
    if (receiptRef.current) {
      const customerName = selectedRepair?.customerName || selectedSale?.id || 'receipt';
      const filename = customerName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      await downloadReceiptAsPDF(receiptRef.current, filename);
    }
  };

  const handleShareWhatsApp = () => {
    if (selectedRepair) {
      const receiptData = {
        id: selectedRepair.id,
        date: selectedRepair.date,
        shopId: selectedRepair.shopId,
        saleType: 'repair' as const,
        items: [
          ...selectedRepair.partsUsed.map(p => ({
            name: p.itemName,
            qty: p.qty,
            price: 0,
          })),
          ...(selectedRepair.additionalItems || []).map(item => ({
            name: item.itemName,
            qty: 1,
            price: 0,
          })),
        ],
        total: selectedRepair.totalAgreedAmount || selectedRepair.totalCost,
        totalAgreedAmount: selectedRepair.totalAgreedAmount || selectedRepair.totalCost,
        paymentMethod: selectedRepair.pendingTransactionCodes?.paymentMethod || 'unknown',
        paymentStatus: selectedRepair.paymentStatus === 'fully_paid' ? 'paid' : 'not_paid',
        amountPaid: selectedRepair.amountPaid,
        balance: selectedRepair.balance,
        customerName: selectedRepair.customerName,
        customerPhone: selectedRepair.phoneNumber,
        phoneModel: selectedRepair.phoneModel,
        issue: selectedRepair.issue,
        technician: selectedRepair.technician,
        customerStatus: selectedRepair.customerStatus,
        paymentApproved: selectedRepair.paymentApproved,
        depositAmount: selectedRepair.depositAmount || 0,
        ticketNumber: selectedRepair.ticketNumber,
      };
      const text = formatReceiptText(
        receiptData,
        currentShop?.name || 'PHONEMART',
        currentShop?.address,
        currentShop?.phone
      );
      shareViaWhatsApp(text, selectedRepair.phoneNumber);
    } else if (selectedSale) {
      const text = formatReceiptText(
        selectedSale,
        currentShop?.name || 'PHONEMART',
        currentShop?.address,
        currentShop?.phone
      );
      shareViaWhatsApp(text);
    }
  };


  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Customer Data Management</h2>
      
      {/* Search and Filter */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <input
              type="text"
              placeholder="Search by customer name, phone, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'repairs' | 'sales')}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All Records</option>
              <option value="repairs">Repairs Only</option>
              <option value="sales">Sales Only</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Repairs Section */}
        <div className="bg-white rounded shadow">
          <h3 className="text-lg font-semibold p-4 border-b">Repair Records ({filteredRepairs.length})</h3>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            {filteredRepairs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No repair records found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Customer</th>
                    <th className="p-2 text-left">Phone</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRepairs.map((repair) => (
                    <tr key={repair.id} className="border-t hover:bg-gray-50">
                      <td className="p-2">{new Date(repair.date).toLocaleDateString()}</td>
                      <td className="p-2">{repair.customerName}</td>
                      <td className="p-2">{repair.phoneModel}</td>
                      <td className="p-2 text-right">KES {(repair.totalAgreedAmount || repair.totalCost).toLocaleString()}</td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReprintRepair(repair)}
                            className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                          >
                            Reprint
                          </button>
                          <button
                            onClick={() => handleDeleteRepair(repair.id, repair.customerName)}
                            className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Sales Section */}
        <div className="bg-white rounded shadow">
          <h3 className="text-lg font-semibold p-4 border-b">Sales Records ({filteredSales.length})</h3>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            {filteredSales.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No sales records found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-left">Items</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="border-t hover:bg-gray-50">
                      <td className="p-2">{new Date(sale.date).toLocaleDateString()}</td>
                      <td className="p-2 capitalize">{sale.saleType}</td>
                      <td className="p-2">{sale.items.length} items</td>
                      <td className="p-2 text-right">KES {sale.total.toLocaleString()}</td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReprintSale(sale)}
                            className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                          >
                            Reprint
                          </button>
                          <button
                            onClick={() => handleDeleteSale(sale.id)}
                            className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Receipt Preview Modal */}
      {(selectedRepair || selectedSale) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Receipt Preview</h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadPDF}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    Download PDF
                  </button>
                  <button
                    onClick={handleShareWhatsApp}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    Share WhatsApp
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRepair(null);
                      setSelectedSale(null);
                    }}
                    className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div ref={receiptRef}>
                {selectedRepair ? (
                  <Receipt
                    sale={{
                      id: selectedRepair.id,
                      date: selectedRepair.date,
                      shopId: selectedRepair.shopId,
                      saleType: 'in-shop' as const,
                      items: [
                        ...selectedRepair.partsUsed.map(p => ({
                          name: p.itemName,
                          qty: p.qty,
                          price: 0,
                        })),
                        ...(selectedRepair.additionalItems || []).map(item => ({
                          name: item.itemName,
                          qty: 1,
                          price: 0,
                        })),
                      ],
                      total: selectedRepair.totalAgreedAmount || selectedRepair.totalCost,
                      paymentMethod: selectedRepair.pendingTransactionCodes?.paymentMethod || 'unknown',
                      paymentStatus: selectedRepair.paymentStatus,
                      amountPaid: selectedRepair.amountPaid,
                      balance: selectedRepair.balance,
                      customerName: selectedRepair.customerName,
                      customerPhone: selectedRepair.phoneNumber,
                      phoneModel: selectedRepair.phoneModel,
                      issue: selectedRepair.issue,
                      technician: selectedRepair.technician,
                      customerStatus: selectedRepair.customerStatus,
                      paymentApproved: selectedRepair.paymentApproved,
                      depositAmount: selectedRepair.depositAmount || 0,
                      ticketNumber: selectedRepair.ticketNumber,
                      totalAgreedAmount: selectedRepair.totalAgreedAmount || selectedRepair.totalCost,
                    } as any}
                  />
                ) : selectedSale ? (
                  <Receipt sale={selectedSale} />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
