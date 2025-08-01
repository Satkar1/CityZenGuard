import jsPDF from "jspdf";
import { Fir } from "../../shared/schema";

export const firService = {
  generatePDF(fir: Fir): Buffer {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text("FIRST INFORMATION REPORT (FIR)", 20, 20);
    
    doc.setFontSize(12);
    doc.text(`FIR Number: ${fir.firNumber}`, 20, 35);
    doc.text(`Date: ${fir.incidentDate?.toLocaleDateString()}`, 120, 35);
    doc.text(`Time: ${fir.incidentTime}`, 20, 45);
    
    // Incident Details
    doc.setFontSize(14);
    doc.text("INCIDENT DETAILS", 20, 65);
    doc.setFontSize(10);
    doc.text(`Type: ${fir.incidentType}`, 20, 75);
    doc.text(`Location: ${fir.location}`, 20, 85);
    
    // Description
    doc.text("Description:", 20, 100);
    const splitDescription = doc.splitTextToSize(fir.description, 170);
    doc.text(splitDescription, 20, 110);
    
    // Victim Information
    const yPos = 110 + (splitDescription.length * 5) + 15;
    doc.setFontSize(14);
    doc.text("VICTIM INFORMATION", 20, yPos);
    doc.setFontSize(10);
    doc.text(`Name: ${fir.victimName}`, 20, yPos + 10);
    doc.text(`Contact: ${fir.victimContact}`, 20, yPos + 20);
    doc.text(`Address: ${fir.victimAddress}`, 20, yPos + 30);
    
    // Legal Sections
    if (fir.legalSections && fir.legalSections.length > 0) {
      const sectionsYPos = yPos + 50;
      doc.setFontSize(14);
      doc.text("APPLICABLE LEGAL SECTIONS", 20, sectionsYPos);
      doc.setFontSize(10);
      fir.legalSections.forEach((section, index) => {
        doc.text(`• ${section}`, 20, sectionsYPos + 10 + (index * 8));
      });
    }
    
    return Buffer.from(doc.output('arraybuffer'));
  },
};
