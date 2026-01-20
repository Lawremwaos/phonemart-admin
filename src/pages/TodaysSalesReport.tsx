import { useSales } from "../context/SalesContext";
// import { useShop } from "../context/ShopContext";
import { shareViaWhatsApp, shareViaEmail } from "../utils/receiptUtils";

export default function TodaysSalesReport() {
  const { getTodaysSalesReport, getDailySales } = useSales();
  // const { currentShop } = useShop();
  const report = getTodaysSalesReport();
  const todaysSales = getDailySales();

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleShareWhatsApp = () => {
    let text = `*TODAY'S SALES REPORT*\n`;
    text += `${formatDate(new Date())}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `*SUMMARY*\n`;
    text += `Total Sales: ${report.totalSales}\n`;
    text += `Retail Sales: ${report.retailSales}\n`;
    text += `Wholesale Sales: ${report.wholesaleSales}\n`;
    text += `Total Amount: KES ${report.totalAmount.toLocaleString()}\n`;
    text += `Total Deposited: KES ${report.totalDeposited.toLocaleString()}\n`;
    text += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    if (report.transactionReferences.length > 0) {
      text += `*TRANSACTION REFERENCES*\n`;
      report.transactionReferences.forEach((ref, idx) => {
        text += `${idx + 1}. ${ref.method.toUpperCase()}: ${ref.reference}\n`;
        text += `   Amount: KES ${ref.amount.toLocaleString()}\n`;
        if (ref.bank) text += `   Bank: ${ref.bank}\n`;
        text += `\n`;
      });
    }
    
    text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*DETAILED SALES*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    todaysSales.forEach((sale, idx) => {
      text += `\n${idx + 1}. ${sale.saleType === 'wholesale' ? 'Wholesale' : 'Retail'} Sale\n`;
      text += `   Items: ${sale.items.map(i => `${i.name} (x${i.qty})`).join(', ')}\n`;
      text += `   Total: KES ${sale.total.toLocaleString()}\n`;
      if (sale.paymentType) {
        text += `   Payment: ${sale.paymentType}\n`;
      }
      if (sale.depositReference) {
        text += `   Reference: ${sale.depositReference}\n`;
      }
    });
    
    shareViaWhatsApp(text, "+254715592682");
  };

  const handleShareEmail = () => {
    const subject = `Today's Sales Report - ${formatDate(new Date())}`;
    let body = `TODAY'S SALES REPORT\n`;
    body += `${formatDate(new Date())}\n`;
    body += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    body += `SUMMARY\n`;
    body += `Total Sales: ${report.totalSales}\n`;
    body += `Retail Sales: ${report.retailSales}\n`;
    body += `Wholesale Sales: ${report.wholesaleSales}\n`;
    body += `Total Amount: KES ${report.totalAmount.toLocaleString()}\n`;
    body += `Total Deposited: KES ${report.totalDeposited.toLocaleString()}\n`;
    body += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    if (report.transactionReferences.length > 0) {
      body += `TRANSACTION REFERENCES\n`;
      report.transactionReferences.forEach((ref, idx) => {
        body += `${idx + 1}. ${ref.method.toUpperCase()}: ${ref.reference}\n`;
        body += `   Amount: KES ${ref.amount.toLocaleString()}\n`;
        if (ref.bank) body += `   Bank: ${ref.bank}\n`;
        body += `\n`;
      });
    }
    
    body += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    body += `DETAILED SALES\n`;
    body += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    todaysSales.forEach((sale, idx) => {
      body += `\n${idx + 1}. ${sale.saleType === 'wholesale' ? 'Wholesale' : 'Retail'} Sale\n`;
      body += `   Items: ${sale.items.map(i => `${i.name} (x${i.qty})`).join(', ')}\n`;
      body += `   Total: KES ${sale.total.toLocaleString()}\n`;
      if (sale.paymentType) {
        body += `   Payment: ${sale.paymentType}\n`;
      }
      if (sale.depositReference) {
        body += `   Reference: ${sale.depositReference}\n`;
      }
    });
    
    shareViaEmail(subject, body);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Today's Sales Report</h1>
        <div className="flex gap-4">
          <button
            onClick={handleShareWhatsApp}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Share via WhatsApp
          </button>
          <button
            onClick={handleShareEmail}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Share via Email
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-600">Total Sales</p>
          <p className="text-2xl font-bold">{report.totalSales}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-600">Retail Sales</p>
          <p className="text-2xl font-bold text-blue-600">{report.retailSales}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-600">Wholesale Sales</p>
          <p className="text-2xl font-bold text-purple-600">{report.wholesaleSales}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <p className="text-sm text-gray-600">Total Amount</p>
          <p className="text-2xl font-bold text-green-600">KES {report.totalAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Amount Summary */}
      <div className="bg-white p-6 rounded shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Amount Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Amount Expected</p>
            <p className="text-2xl font-bold">KES {report.totalAmount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Amount Deposited</p>
            <p className="text-2xl font-bold text-green-600">KES {report.totalDeposited.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Transaction References */}
      {report.transactionReferences.length > 0 && (
        <div className="bg-white p-6 rounded shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Transaction References</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bank</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {report.transactionReferences.map((ref, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium capitalize">{ref.method}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{ref.reference}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">KES {ref.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{ref.bank || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Sales */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Detailed Sales</h2>
        {todaysSales.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No sales recorded today.</p>
        ) : (
          <div className="space-y-4">
            {todaysSales.map((sale, idx) => (
              <div key={sale.id} className="border border-gray-200 rounded p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {sale.saleType === 'wholesale' ? 'Wholesale' : 'Retail'} Sale #{idx + 1}
                    </span>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(sale.date).toLocaleTimeString()}
                    </p>
                  </div>
                  <p className="text-lg font-bold">KES {sale.total.toLocaleString()}</p>
                </div>
                <div className="mt-2">
                  <p className="text-sm font-medium mb-1">Items:</p>
                  <ul className="list-disc list-inside text-sm text-gray-600">
                    {sale.items.map((item, itemIdx) => (
                      <li key={itemIdx}>
                        {item.name} x {item.qty} @ KES {item.price.toLocaleString()} = KES {(item.qty * item.price).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </div>
                {sale.paymentType && (
                  <div className="mt-2 text-sm">
                    <span className="text-gray-600">Payment: </span>
                    <span className="font-medium capitalize">{sale.paymentType}</span>
                    {sale.depositReference && (
                      <>
                        <span className="text-gray-600 ml-2">| Reference: </span>
                        <span className="font-mono">{sale.depositReference}</span>
                      </>
                    )}
                    {sale.bank && (
                      <>
                        <span className="text-gray-600 ml-2">| Bank: </span>
                        <span className="font-medium">{sale.bank}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
