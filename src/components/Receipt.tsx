import { type Sale } from "../context/SalesContext";

type ReceiptProps = {
  sale: Sale;
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
};

export default function Receipt({ sale, shopName = "PHONEMART", shopAddress = "", shopPhone = "" }: ReceiptProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white p-8 max-w-md mx-auto shadow-lg" id="receipt">
      {/* Header */}
      <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
        <h1 className="text-3xl font-bold text-gray-900">{shopName}</h1>
        {shopAddress && <p className="text-sm text-gray-600 mt-1">{shopAddress}</p>}
        {shopPhone && <p className="text-sm text-gray-600">{shopPhone}</p>}
      </div>

      {/* Receipt Info */}
      <div className="mb-4 text-sm">
        <div className="flex justify-between mb-2">
          <span className="text-gray-600">Receipt #:</span>
          <span className="font-semibold">{sale.id}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-gray-600">Date & Time:</span>
          <span className="font-semibold">{formatDate(sale.date)}</span>
        </div>
        {sale.saleType && (
          <div className="flex justify-between mb-2">
            <span className="text-gray-600">Sale Type:</span>
            <span className="font-semibold capitalize">{sale.saleType === 'in-shop' ? 'In-Shop Sale' : 'Wholesale'}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="border-t border-b border-gray-300 py-4 mb-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-2 text-sm font-semibold text-gray-700">Item</th>
              <th className="text-center py-2 text-sm font-semibold text-gray-700">Qty</th>
              <th className="text-right py-2 text-sm font-semibold text-gray-700">Unit Price</th>
              <th className="text-right py-2 text-sm font-semibold text-gray-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, index) => (
              <tr key={index} className="border-b border-gray-200">
                <td className="py-2 text-sm font-medium">{item.name}</td>
                <td className="py-2 text-center text-sm">{item.qty}</td>
                <td className="py-2 text-right text-sm">KES {item.price.toLocaleString()}</td>
                <td className="py-2 text-right text-sm font-semibold">
                  KES {(item.qty * item.price).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total */}
      <div className="border-t-2 border-gray-800 pt-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-lg font-semibold text-gray-700">Subtotal:</span>
          <span className="text-lg font-semibold text-gray-700">KES {sale.total.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-gray-300">
          <span className="text-xl font-bold text-gray-900">TOTAL:</span>
          <span className="text-2xl font-bold text-gray-900">KES {sale.total.toLocaleString()}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-xs text-gray-500 border-t border-gray-300 pt-4">
        <p>Thank you for your business!</p>
        <p className="mt-2">This is a digital receipt</p>
      </div>
    </div>
  );
}
