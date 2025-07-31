import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  id: string;
  message: string;
  isFromAI: boolean;
  createdAt: string;
}

export default function ChatInterface() {
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/chat/messages"],
    queryFn: async () => {
      const token = authService.getToken();
      const response = await fetch("/api/chat/messages", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const token = authService.getToken();
      return apiRequest("POST", "/api/chat/message", {
        message,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      setInputMessage("");
    },
    onError: () => {
      toast({
        title: "Failed to send message",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    sendMessageMutation.mutate(inputMessage.trim());
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading chat...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-legal-blue text-white p-4 flex flex-row items-center">
        <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z"/>
        </svg>
        <h3 className="text-lg font-semibold">AI Legal Assistant</h3>
        <Badge className="ml-auto bg-green-500">Online</Badge>
      </CardHeader>

      <CardContent className="p-0">
        <div className="chat-messages p-6 bg-gray-50 h-96 overflow-y-auto">
          {messages.length === 0 && (
            <div className="mb-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-legal-blue rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z"/>
                  </svg>
                </div>
                <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 max-w-xs lg:max-w-md shadow-sm">
                  <p className="text-gray-800">Hello! I'm your AI Legal Assistant. How can I help you today? You can ask me about:</p>
                  <ul className="mt-2 text-sm text-gray-600 space-y-1">
                    <li>• Case status inquiries</li>
                    <li>• FIR filing assistance</li>
                    <li>• Court hearing information</li>
                    <li>• Legal procedure explanations</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className="mb-4">
              {message.isFromAI ? (
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-legal-blue rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z"/>
                    </svg>
                  </div>
                  <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 max-w-xs lg:max-w-md shadow-sm">
                    <p className="text-gray-800">{message.message}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start space-x-3 justify-end">
                  <div className="bg-legal-blue text-white rounded-2xl rounded-tr-none px-4 py-3 max-w-xs lg:max-w-md">
                    <p>{message.message}</p>
                  </div>
                  <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z"/>
                    </svg>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {sendMessageMutation.isPending && (
            <div className="mb-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-legal-blue rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z"/>
                  </svg>
                </div>
                <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                  <div className="message-typing text-gray-500">Thinking...</div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-gray-200 p-4 bg-white">
          <form onSubmit={handleSendMessage} className="flex space-x-3">
            <Input
              type="text"
              placeholder="Type your legal question here..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="flex-1 rounded-full"
              disabled={sendMessageMutation.isPending}
            />
            <Button 
              type="submit" 
              className="bg-legal-blue hover:bg-legal-blue-light rounded-full p-3"
              disabled={sendMessageMutation.isPending || !inputMessage.trim()}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/>
              </svg>
            </Button>
          </form>
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
            <span>Powered by Gemini AI for intelligent legal assistance</span>
            <span>Press Enter to send</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
