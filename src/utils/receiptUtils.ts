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
  const whatsappUrl = phoneNumber 
    ? `https://wa.me/${phoneNumber}?text=${encodedText}`
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

  let text = `*${shopName}*\n`;
  if (shopAddress) {
    text += `${shopAddress}\n`;
  }
  if (shopPhone) {
    text += `Phone: ${shopPhone}\n`;
  }
  text += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `*Receipt #${sale.id}*\n`;
  text += `Date & Time: ${dateTime}\n`;
  if (sale.saleType) {
    const saleTypeText = sale.saleType === 'in-shop' ? 'In-Shop Sale' : 'Wholesale';
    text += `Sale Type: ${saleTypeText}\n`;
  }
  text += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `*ITEMS*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  sale.items.forEach((item: any) => {
    const itemTotal = item.qty * item.price;
    text += `${item.name}\n`;
    text += `  Qty: ${item.qty} × KES ${item.price.toLocaleString()} = KES ${itemTotal.toLocaleString()}\n`;
  });
  text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  text += `*TOTAL: KES ${sale.total.toLocaleString()}*\n`;
  text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  text += `\nThank you for your business!`;
  text += `\nThis is a digital receipt.`;
  return text;
};
