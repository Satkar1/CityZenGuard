import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/header";
import ChatInterface from "@/components/chat-interface";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { authService } from "@/lib/auth";

export default function CitizenDashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("chat");
  const user = authService.getCurrentUser();

  useEffect(() => {
    if (!authService.isAuthenticated() || user?.role !== "citizen") {
      setLocation("/login");
    }
  }, [setLocation, user]);

  const { data: cases = [] } = useQuery({
    queryKey: ["/api/cases"],
    queryFn: async () => {
      const token = authService.getToken();
      const response = await fetch("/api/cases", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch cases");
      return response.json();
    },
    enabled: !!user,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const token = authService.getToken();
      const response = await fetch("/api/notifications", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch notifications");
      return response.json();
    },
    enabled: !!user,
  });

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Sidebar */}
          <div className="lg:w-64">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-legal-blue mb-6">Citizen Dashboard</h3>
                <nav className="space-y-2">
                  <Button
                    variant={activeTab === "chat" ? "default" : "ghost"}
                    className={`w-full justify-start ${
                      activeTab === "chat" 
                        ? "bg-legal-blue-lighter text-legal-blue" 
                        : "hover:bg-gray-100"
                    }`}
                    onClick={() => setActiveTab("chat")}
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14l4 4V4a2 2 0 0 0-2-2z"/>
                    </svg>
                    AI Legal Assistant
                  </Button>
                  
                  <Button
                    variant={activeTab === "cases" ? "default" : "ghost"}
                    className={`w-full justify-start ${
                      activeTab === "cases" 
                        ? "bg-legal-blue-lighter text-legal-blue" 
                        : "hover:bg-gray-100"
                    }`}
                    onClick={() => setActiveTab("cases")}
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
                    </svg>
                    My Cases
                  </Button>
                  
                  <Button
                    variant={activeTab === "fir-status" ? "default" : "ghost"}
                    className={`w-full justify-start ${
                      activeTab === "fir-status" 
                        ? "bg-legal-blue-lighter text-legal-blue" 
                        : "hover:bg-gray-100"
                    }`}
                    onClick={() => setActiveTab("fir-status")}
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                    </svg>
                    FIR Status
                  </Button>
                  
                  <Button
                    variant={activeTab === "notifications" ? "default" : "ghost"}
                    className={`w-full justify-start ${
                      activeTab === "notifications" 
                        ? "bg-legal-blue-lighter text-legal-blue" 
                        : "hover:bg-gray-100"
                    }`}
                    onClick={() => setActiveTab("notifications")}
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                    </svg>
                    Notifications
                    {notifications.filter((n: any) => !n.isRead).length > 0 && (
                      <Badge className="ml-auto bg-red-500 text-white">
                        {notifications.filter((n: any) => !n.isRead).length}
                      </Badge>
                    )}
                  </Button>
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Chat Interface */}
            {activeTab === "chat" && <ChatInterface />}

            {/* Cases Tab */}
            {activeTab === "cases" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-legal-blue">My Cases</CardTitle>
                </CardHeader>
                <CardContent>
                  {cases.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
                      </svg>
                      <p>No cases found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cases.map((case_: any) => (
                        <Card key={case_.id} className="border hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className="font-semibold text-gray-900">{case_.caseNumber}</h4>
                                <p className="text-sm text-gray-600">{case_.type}</p>
                              </div>
                              <Badge 
                                className={
                                  case_.status === "Pending" ? "bg-yellow-100 text-yellow-800" :
                                  case_.status === "Investigation Complete" ? "bg-green-100 text-green-800" :
                                  "bg-gray-100 text-gray-800"
                                }
                              >
                                {case_.status}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <p><strong>Next Hearing:</strong> {case_.nextHearing ? new Date(case_.nextHearing).toLocaleDateString() : "Not scheduled"}</p>
                              <p><strong>Court:</strong> {case_.court || "Not assigned"}</p>
                            </div>
                            <Button variant="link" className="mt-3 p-0 text-legal-blue">
                              View Details
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* FIR Status Tab */}
            {activeTab === "fir-status" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-legal-blue">FIR Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                    </svg>
                    <p>No FIRs to display</p>
                    <p className="text-sm mt-2">File an FIR through our AI assistant or contact your local police station</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notifications Tab */}
            {activeTab === "notifications" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-legal-blue">Notifications</CardTitle>
                </CardHeader>
                <CardContent>
                  {notifications.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                      </svg>
                      <p>No notifications</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {notifications.map((notification: any) => (
                        <Card key={notification.id} className={`border ${!notification.isRead ? 'bg-blue-50' : ''}`}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">{notification.title}</h4>
                                <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                                <p className="text-xs text-gray-400 mt-2">
                                  {new Date(notification.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              {!notification.isRead && (
                                <Badge className="bg-blue-500">New</Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
