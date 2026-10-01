import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { Send, Bot, User, Sparkles } from "lucide-react";

interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  suggestions?: string[];
}

const knowledgeBase: Record<string, { answer: string; suggestions?: string[] }> = {
  "requirements": {
    answer: "Here are the general requirements for barangay certificates:\n\n• Valid Government ID (photocopy)\n• Proof of Residency (utility bill or lease contract)\n• Recent 2x2 ID photo\n• Community Tax Certificate (for some certificates)\n• Purpose/reason for request\n\nSpecific certificates may have additional requirements. Which certificate do you need?",
    suggestions: ["Barangay Clearance", "Certificate of Residency", "Certificate of Indigency"]
  },
  "barangay clearance": {
    answer: "Barangay Clearance Requirements:\n\n1. Accomplished application form\n2. Valid government-issued ID (original and photocopy)\n3. Proof of residency (utility bill, lease contract, or affidavit)\n4. Two (2) pieces of 2x2 ID photos\n5. Community Tax Certificate (Cedula)\n6. Processing fee: ₱50.00\n\nProcessing time: 1-2 business days\n\nWould you like to book an appointment?",
    suggestions: ["Book appointment", "Other certificates", "Office hours"]
  },
  "certificate of residency": {
    answer: "Certificate of Residency Requirements:\n\n1. Accomplished application form\n2. Valid government-issued ID\n3. Proof of residence (utility bill or barangay certificate)\n4. One (1) piece of 2x2 ID photo\n5. Processing fee: ₱30.00\n\nProcessing time: 1 business day\n\nThis certificate proves that you are a resident of the barangay.",
    suggestions: ["Book appointment", "Requirements for other certificates"]
  },
  "certificate of indigency": {
    answer: "Certificate of Indigency Requirements:\n\n1. Accomplished application form\n2. Valid government-issued ID\n3. Proof of residency\n4. Barangay certification from your area chairman\n5. Purpose/reason (usually for medical, legal, or educational assistance)\n6. No processing fee\n\nProcessing time: 1-2 business days\n\nNote: This certificate is issued to residents who need financial assistance.",
    suggestions: ["Book appointment", "What can I use this for?"]
  },
  "schedule": {
    answer: "Barangay Office Schedule:\n\n📅 Monday to Friday: 8:00 AM - 5:00 PM\n🔴 Closed on weekends and holidays\n\nLunch Break: 12:00 PM - 1:00 PM\n\nBest time to visit: 8:00 AM - 11:00 AM or 2:00 PM - 4:00 PM (less crowded)\n\nYou can book an appointment to avoid long queues!",
    suggestions: ["Book appointment", "How to get there", "Contact information"]
  },
  "office hours": {
    answer: "Barangay Office Schedule:\n\n📅 Monday to Friday: 8:00 AM - 5:00 PM\n🔴 Closed on weekends and holidays\n\nLunch Break: 12:00 PM - 1:00 PM\n\nBest time to visit: 8:00 AM - 11:00 AM or 2:00 PM - 4:00 PM (less crowded)\n\nYou can book an appointment to avoid long queues!",
    suggestions: ["Book appointment", "How to get there", "Contact information"]
  },
  "appointment": {
    answer: "To book an appointment:\n\n1. Go to the 'Appointments' tab\n2. Select the type of certificate you need\n3. Fill in your personal information\n4. Choose your preferred date and time\n5. Submit your request\n\nYou will receive a confirmation within 24 hours via SMS or email.\n\nWould you like me to guide you through the process?",
    suggestions: ["View appointment tab", "What documents to bring", "How long is processing"]
  },
  "processing time": {
    answer: "Average Processing Time:\n\n✅ Certificate of Residency: 1 business day\n✅ Barangay Clearance: 1-2 business days\n✅ Certificate of Indigency: 1-2 business days\n✅ Business Permit Clearance: 2-3 business days\n✅ Good Moral Certificate: 1-2 business days\n\nProcessing may be faster with complete requirements. Incomplete documents will delay processing.",
    suggestions: ["What are the requirements?", "Book appointment"]
  },
  "fees": {
    answer: "Barangay Certificate Fees:\n\n💰 Barangay Clearance: ₱50.00\n💰 Certificate of Residency: ₱30.00\n💰 Certificate of Indigency: FREE\n💰 Business Permit Clearance: ₱100.00\n💰 Good Moral Certificate: ₱30.00\n💰 Community Tax Certificate (Cedula): Based on income\n\nPayment methods: Cash only (at the barangay office)\n\nNote: Fees are subject to change. Please confirm at the office.",
    suggestions: ["Book appointment", "What documents to bring"]
  },
  "contact": {
    answer: "Barangay Contact Information:\n\n📞 Telephone: (02) 8XXX-XXXX\n📱 Mobile: 0917-XXX-XXXX\n📧 Email: barangay@example.gov.ph\n📍 Address: Barangay Hall, Main Street, City\n\nOffice Hours: Monday-Friday, 8:00 AM - 5:00 PM\n\nFor emergencies, please call our 24/7 hotline: 911",
    suggestions: ["Office hours", "How to get there"]
  }
};

const quickQuestions = [
  "What are the requirements?",
  "Office hours",
  "How to book appointment?",
  "Processing time and fees"
];

export default function ChatbotInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Hello! I'm your Barangay AI Assistant. I can help you with information about:\n\n• Certificate requirements\n• Office hours and schedules\n• Appointment booking process\n• Processing times and fees\n• Contact information\n\nHow can I assist you today?",
      sender: "bot",
      timestamp: new Date(),
      suggestions: quickQuestions
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const findBestMatch = (query: string): { answer: string; suggestions?: string[] } => {
    const lowerQuery = query.toLowerCase();

    // Direct keyword matching
    for (const [key, value] of Object.entries(knowledgeBase)) {
      if (lowerQuery.includes(key)) {
        return value;
      }
    }

    // Fuzzy matching for common variations
    if (lowerQuery.includes("requirement") || lowerQuery.includes("need") || lowerQuery.includes("document")) {
      return knowledgeBase["requirements"];
    }
    if (lowerQuery.includes("time") || lowerQuery.includes("hour") || lowerQuery.includes("open")) {
      return knowledgeBase["schedule"];
    }
    if (lowerQuery.includes("book") || lowerQuery.includes("appointment") || lowerQuery.includes("reservation")) {
      return knowledgeBase["appointment"];
    }
    if (lowerQuery.includes("cost") || lowerQuery.includes("price") || lowerQuery.includes("fee") || lowerQuery.includes("payment")) {
      return knowledgeBase["fees"];
    }
    if (lowerQuery.includes("how long") || lowerQuery.includes("processing")) {
      return knowledgeBase["processing time"];
    }
    if (lowerQuery.includes("contact") || lowerQuery.includes("phone") || lowerQuery.includes("email") || lowerQuery.includes("reach")) {
      return knowledgeBase["contact"];
    }

    // Default response
    return {
      answer: "I'm not sure I understand that question. Here's what I can help you with:\n\n• Certificate requirements and types\n• Office schedules and hours\n• Appointment booking\n• Processing times and fees\n• Contact information\n\nCould you please rephrase your question or choose from the suggestions below?",
      suggestions: quickQuestions
    };
  };

  const handleSendMessage = (messageText?: string) => {
    const text = messageText || inputMessage.trim();
    if (!text) return;

    // Add user message
    const userMessage: Message = {
      id: messages.length + 1,
      text,
      sender: "user",
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);

    // Simulate bot response delay
    setTimeout(() => {
      const response = findBestMatch(text);
      const botMessage: Message = {
        id: messages.length + 2,
        text: response.answer,
        sender: "bot",
        timestamp: new Date(),
        suggestions: response.suggestions
      };
      setMessages(prev => [...prev, botMessage]);
      setIsTyping(false);
    }, 800);
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  return (
    <Card className="max-w-4xl mx-auto h-[600px] flex flex-col">
      <CardHeader className="border-b">
        <CardTitle>AI Assistant</CardTitle>
        <CardDescription>
          Ask about certificates and procedures
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${message.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.sender === "bot" && (
                  <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
                <div className={`flex flex-col gap-2 max-w-[80%] ${message.sender === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`rounded-lg px-3 py-2 text-sm ${
                      message.sender === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-line">{message.text}</p>
                  </div>
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {message.suggestions.map((suggestion, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="text-xs h-7"
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                {message.sender === "user" && (
                  <div className="w-7 h-7 bg-muted rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-2">
                <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your question here..."
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!inputMessage.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            AI provides guidance only. Visit the office for official transactions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
