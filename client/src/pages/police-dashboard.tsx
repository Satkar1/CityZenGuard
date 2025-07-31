import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/header";
import FirDrafting from "@/components/fir-drafting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { authService } from "@/lib/auth";

export default function PoliceDashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("fir-draft");
  const user = authService.getCurrentUser();

  useEffect(() => {
    if (!authService.isAuthenticated() || user?.role !== "police") {
      setLocation("/login");
    }
  }, [setLocation, user]);

  const { data: firs = [] } = useQuery({
    queryKey: ["/api/firs"],
    queryFn: async () => {
      const token = authService.getToken();
      const response = await fetch("/api/firs", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch FIRs");
      return response.json();
    },
    enabled: !!user,
  });

  if (!user) {
    return null;
  }

  const pendingFirs = firs.filter((fir: any) => fir.status === "draft");

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Sidebar */}
          <div className="lg:w-64">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-legal-blue mb-6">Police Dashboard</h3>
                <nav className="space-y-2">
                  <Button
                    variant={activeTab === "fir-draft" ? "default" : "ghost"}
                    className={`w-full justify-start ${
                      activeTab === "fir-draft" 
                        ? "bg-legal-blue-lighter text-legal-blue" 
                        : "hover:bg-gray-100"
                    }`}
                    onClick={() => setActiveTab("fir-draft")}
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/>
                    </svg>
                    Draft New FIR
                  </Button>
                  
                  <Button
                    variant={activeTab === "pending-firs" ? "default" : "ghost"}
                    className={`w-full justify-start ${
                      activeTab === "pending-firs" 
                        ? "bg-legal-blue-lighter text-legal-blue" 
                        : "hover:bg-gray-100"
                    }`}
                    onClick={() => setActiveTab("pending-firs")}
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    Pending FIRs
                    {pendingFirs.length > 0 && (
                      <Badge className="ml-auto bg-orange-500 text-white">
                        {pendingFirs.length}
                      </Badge>
                    )}
                  </Button>
                  
                  <Button
                    variant={activeTab === "case-updates" ? "default" : "ghost"}
                    className={`w-full justify-start ${
                      activeTab === "case-updates" 
                        ? "bg-legal-blue-lighter text-legal-blue" 
                        : "hover:bg-gray-100"
                    }`}
                    onClick={() => setActiveTab("case-updates")}
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1-2.73 2.71-2.73 7.08 0 9.79 2.73 2.71 7.15 2.71 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 1.98-.88 4.55-2.64 6.29-3.51 3.48-9.21 3.48-12.72 0-3.5-3.47-3.53-9.11-.02-12.58 3.51-3.47 9.14-3.47 12.65 0L21 3v7.12zM12.5 8v4.25l3.5 2.08-.72 1.21L11 13V8h1.5z"/>
                    </svg>
                    Case Updates
                  </Button>
                  
                  <Button
                    variant={activeTab === "legal-resources" ? "default" : "ghost"}
                    className={`w-full justify-start ${
                      activeTab === "legal-resources" 
                        ? "bg-legal-blue-lighter text-legal-blue" 
                        : "hover:bg-gray-100"
                    }`}
                    onClick={() => setActiveTab("legal-resources")}
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                    </svg>
                    Legal Resources
                  </Button>
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* FIR Drafting Interface */}
            {activeTab === "fir-draft" && <FirDrafting />}

            {/* Pending FIRs Tab */}
            {activeTab === "pending-firs" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-legal-blue">Pending FIRs</CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingFirs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                      </svg>
                      <p>No pending FIRs</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pendingFirs.map((fir: any) => (
                        <Card key={fir.id} className="border hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className="font-semibold text-gray-900">{fir.firNumber || "Draft FIR"}</h4>
                                <p className="text-sm text-gray-600">{fir.incidentType}</p>
                              </div>
                              <Badge className="bg-orange-100 text-orange-800">
                                {fir.status}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <p><strong>Created:</strong> {new Date(fir.createdAt).toLocaleDateString()}</p>
                              <p><strong>Location:</strong> {fir.location}</p>
                            </div>
                            <div className="flex space-x-3 mt-3">
                              <Button variant="link" className="p-0 text-legal-blue">
                                Continue Editing
                              </Button>
                              <Button variant="link" className="p-0 text-gray-600">
                                View Details
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Case Updates Tab */}
            {activeTab === "case-updates" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-legal-blue">Case Updates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1-2.73 2.71-2.73 7.08 0 9.79 2.73 2.71 7.15 2.71 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 1.98-.88 4.55-2.64 6.29-3.51 3.48-9.21 3.48-12.72 0-3.5-3.47-3.53-9.11-.02-12.58 3.51-3.47 9.14-3.47 12.65 0L21 3v7.12zM12.5 8v4.25l3.5 2.08-.72 1.21L11 13V8h1.5z"/>
                    </svg>
                    <p>No case updates available</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Legal Resources Tab */}
            {activeTab === "legal-resources" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-legal-blue">Legal Resources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card className="border">
                      <CardContent className="p-6">
                        <h3 className="font-semibold text-legal-blue mb-3">IPC Sections Guide</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Quick reference guide for Indian Penal Code sections commonly used in FIR drafting.
                        </p>
                        <Button variant="outline" size="sm">View Guide</Button>
                      </CardContent>
                    </Card>
                    
                    <Card className="border">
                      <CardContent className="p-6">
                        <h3 className="font-semibold text-legal-blue mb-3">Legal Procedures</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Step-by-step procedures for various legal processes and documentation.
                        </p>
                        <Button variant="outline" size="sm">View Procedures</Button>
                      </CardContent>
                    </Card>
                    
                    <Card className="border">
                      <CardContent className="p-6">
                        <h3 className="font-semibold text-legal-blue mb-3">Forms & Templates</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Downloadable forms and templates for various legal documents.
                        </p>
                        <Button variant="outline" size="sm">Download Forms</Button>
                      </CardContent>
                    </Card>
                    
                    <Card className="border">
                      <CardContent className="p-6">
                        <h3 className="font-semibold text-legal-blue mb-3">Training Materials</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Training resources and materials for police officers on legal procedures.
                        </p>
                        <Button variant="outline" size="sm">Access Training</Button>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
