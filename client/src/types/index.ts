export interface LegalSection {
  section: string;
  title: string;
  description: string;
  applicable: boolean;
}

export interface FirFormData {
  incidentType: string;
  location: string;
  incidentDate: string;
  incidentTime: string;
  description: string;
  victimName: string;
  victimContact: string;
  victimAddress: string;
  legalSections: string[];
  additionalComments: string;
}

export interface ChatMessage {
  id: string;
  message: string;
  isFromAI: boolean;
  createdAt: Date;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: "citizen" | "police";
  contactNumber?: string;
  policeStationId?: string;
}
