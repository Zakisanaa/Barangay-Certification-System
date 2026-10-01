import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import AppointmentBooking from "./AppointmentBooking";
import Announcements from "./Announcements";
import ChatbotInterface from "./ChatbotInterface";
import { Calendar, MessageSquare, Bell } from "lucide-react";

export default function UserPortal() {
  return (
    <Tabs defaultValue="appointments" className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-6">
        <TabsTrigger value="appointments">
          <Calendar className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Appointments</span>
        </TabsTrigger>
        <TabsTrigger value="announcements">
          <Bell className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Announcements</span>
        </TabsTrigger>
        <TabsTrigger value="chatbot">
          <MessageSquare className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Chatbot</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="appointments">
        <AppointmentBooking />
      </TabsContent>

      <TabsContent value="announcements">
        <Announcements />
      </TabsContent>

      <TabsContent value="chatbot">
        <ChatbotInterface />
      </TabsContent>
    </Tabs>
  );
}
