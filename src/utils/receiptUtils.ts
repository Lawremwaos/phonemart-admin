import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const downloadReceiptAsPDF = async (receiptElement: HTMLElement, filename: string) => {
  try {
    // Create canvas from the receipt element
    const canvas = await html2canvas(receiptElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // Calculate PDF dimensions
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    let position = 0;

    // Add image to PDF
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Save PDF
    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    // Fallback to print if PDF generation fails
    downloadReceiptAsPrint(receiptElement);
  }
};

export const downloadReceiptAsPrint = (receiptElement: HTMLElement) => {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: Arial, sans-serif;
            }
            @media print {
              body { margin: 0; padding: 0; }
              @page { margin: 0.5cm; }
            }
          </style>
        </head>
        <body>
          ${receiptElement.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
};

// Keep the old function name for backward compatibility
export const downloadReceiptAsImage = downloadReceiptAsPrint;

export const shareViaWhatsApp = (text: string, phoneNumber?: string) => {
  const encodedText = encodeURIComponent(text);
  // Clean phone number for wa.me URL: remove +, spaces, dashes, and parentheses
  // wa.me requires format: country code + number (e.g., 254715592682 for +254715592682)
  let cleanPhone: string | undefined;
  if (phoneNumber && phoneNumber.trim()) {
    // Remove all non-digit characters
    cleanPhone = phoneNumber.replace(/[^\d]/g, '');
    // If number starts with 0, replace with country code 254 (Kenya)
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '254' + cleanPhone.substring(1);
    }
    // If 9 digits (Kenyan local format), add 254
    if (cleanPhone.length === 9) {
      cleanPhone = '254' + cleanPhone;
    }
    // If 10 digits and starts with 254, it's valid
    // If 12 digits (254 + 9), it's valid - use as is
  }
  const whatsappUrl = cleanPhone 
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
  window.open(whatsappUrl, '_blank');
};

export const shareViaEmail = (subject: string, body: string, email?: string) => {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  const mailtoUrl = email
    ? `mailto:${email}?subject=${encodedSubject}&body=${encodedBody}`
    : `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
  window.location.href = mailtoUrl;
};

export const formatReceiptText = (sale: any, shopName: string, shopAddress?: string, shopPhone?: string) => {
  const dateTime = new Date(sale.date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const customerName = sale.customerName || `Customer-${sale.id}`;
  
  let text = `*${shopName}*\n`;
  if (shopAddress) text += `${shopAddress}\n`;
  if (shopPhone) text += `${shopPhone}\n`;
  text += `\n*Receipt - ${customerName}*\n`;
  text += `#${sale.id} | ${dateTime}\n`;
  if (sale.saleType) {
    const t = sale.saleType === 'in-shop' ? 'In-Shop' : sale.saleType === 'wholesale' ? 'Wholesale' : 'Repair';
    text += `Type: ${t}\n`;
  }
  if (sale.customerName) {
    text += `Customer: ${sale.customerName}`;
    if (sale.customerPhone) text += ` | ${sale.customerPhone}`;
    text += `\n`;
    if (sale.phoneModel) text += `Phone: ${sale.phoneModel}\n`;
    if (sale.issue || sale.serviceType) {
      let issueLine = sale.issue || '';
      if (sale.serviceType) issueLine += issueLine ? ` | ${sale.serviceType}` : sale.serviceType;
      text += `Issue: ${issueLine}\n`;
    }
  }
  if (sale.items && sale.items.length > 0) {
    text += `\n*Items:*\n`;
    sale.items.forEach((item: any) => {
      text += `• ${item.name}${item.qty > 1 ? ` x${item.qty}` : ''}\n`;
    });
  }
  const totalAmount = sale.totalAgreedAmount || sale.total;
  text += `\n*TOTAL: KES ${totalAmount.toLocaleString()}*\n`;
  if (sale.amountPaid !== undefined && sale.amountPaid > 0) {
    text += `Paid: KES ${sale.amountPaid.toLocaleString()}`;
    if (sale.balance !== undefined && sale.balance > 0) text += ` | Balance: KES ${sale.balance.toLocaleString()}`;
    text += `\n`;
  }
  if (sale.transactionCodes && Array.isArray(sale.transactionCodes) && sale.transactionCodes.length > 0) {
    sale.transactionCodes.forEach((tc: any) => {
      text += `${tc.method.replace(/_/g, ' ').toUpperCase()}: ${tc.code}`;
      if (tc.bank) text += ` (${tc.bank})`;
      text += `\n`;
    });
  }
  text += `\nThank you for your business!`;
  return text;
};
