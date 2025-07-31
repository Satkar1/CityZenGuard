import { Link } from "wouter";
import Header from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center bg-blue-50 rounded-2xl p-12 mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-legal-blue mb-6">
            AI-Powered Legal Assistance System
          </h1>
          <p className="text-xl text-legal-blue-light mb-8 max-w-3xl mx-auto">
            Bridging the gap between citizens and the judicial system through intelligent automation and accessible legal services
          </p>
          <div className="space-x-4">
            <Link href="/register">
              <Button size="lg" className="bg-legal-blue hover:bg-legal-blue-light text-white px-8 py-4 text-lg">
                Get Started
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-legal-blue text-legal-blue hover:bg-legal-blue hover:text-white px-8 py-4 text-lg">
                Login
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <Card className="hover:shadow-xl transition-shadow">
            <CardContent className="p-8 text-center">
              <svg className="w-16 h-16 text-legal-blue mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2M4 18v-6h3v7c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-7h3v6h4v-8c0-2.21-1.79-4-4-4h-2c-.8 0-1.54.31-2.09.81L10.5 8.5c-.55.55-.55 1.44 0 1.99s1.44.55 1.99 0L13 9.98c.28-.28.61-.48.98-.58C14.61 8.88 15.3 8.5 16 8.5h2c1.1 0 2 .9 2 2v7.5z"/>
              </svg>
              <h3 className="text-2xl font-semibold text-legal-blue mb-4">For Citizens</h3>
              <p className="text-gray-600 leading-relaxed">
                Get instant legal assistance, check case status, and receive notifications about your legal matters through our AI-powered chatbot with multilingual support.
              </p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-xl transition-shadow">
            <CardContent className="p-8 text-center">
              <svg className="w-16 h-16 text-legal-blue mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,6A1,1 0 0,1 13,7V8A1,1 0 0,1 12,9A1,1 0 0,1 11,8V7A1,1 0 0,1 12,6M11,11H13V17H11V11Z"/>
              </svg>
              <h3 className="text-2xl font-semibold text-legal-blue mb-4">For Police Officers</h3>
              <p className="text-gray-600 leading-relaxed">
                Automate FIR drafting with AI assistance, get legal section recommendations, and manage cases more efficiently with our intelligent drafting system.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* About Section */}
        <Card className="bg-gray-50">
          <CardContent className="p-8">
            <h2 className="text-3xl font-semibold text-legal-blue text-center mb-6">About the Project</h2>
            <p className="text-gray-700 text-lg leading-relaxed max-w-4xl mx-auto text-center">
              This system aims to improve accessibility, accuracy, and efficiency of legal services in India through AI-powered solutions. 
              It consists of two main modules: an AI-based Interactive Chatbot for citizens and an AI-powered FIR Drafting Assistance System for police stations.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="bg-gray-100 border-t border-gray-200 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-600">
            &copy; 2024 AI Legal Assistance System. Developed as part of Bachelor of Technology in Computer Engineering.
          </p>
        </div>
      </footer>
    </div>
  );
}
