import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Bell, AlertCircle, Info, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";

interface Announcement {
  id: number;
  title: string;
  content: string;
  type: "info" | "alert" | "event";
  date: Date;
  priority: "high" | "normal" | "low";
}

const mockAnnouncements: Announcement[] = [
  {
    id: 1,
    title: "Office Closure - National Holiday",
    content: "The barangay office will be closed on June 12, 2026 in observance of Independence Day. Regular operations will resume on June 13, 2026.",
    type: "alert",
    date: new Date("2026-06-05"),
    priority: "high"
  },
  {
    id: 2,
    title: "New Requirements for Barangay Clearance",
    content: "Effective June 1, 2026, all barangay clearance applications must include a photocopy of a valid government ID and proof of residency (utility bill or lease contract).",
    type: "info",
    date: new Date("2026-06-01"),
    priority: "high"
  },
  {
    id: 3,
    title: "Community Clean-Up Drive",
    content: "Join us for our monthly community clean-up drive on June 15, 2026 at 6:00 AM. Assembly point will be at the barangay hall. Let's keep our community clean and green!",
    type: "event",
    date: new Date("2026-06-03"),
    priority: "normal"
  },
  {
    id: 4,
    title: "Extended Office Hours - June 20-24",
    content: "To better serve our residents, the barangay office will extend operating hours until 6:00 PM from June 20-24, 2026. Take advantage of this opportunity to process your documents.",
    type: "info",
    date: new Date("2026-06-02"),
    priority: "normal"
  },
  {
    id: 5,
    title: "Free Medical Check-Up",
    content: "The barangay health center will conduct free medical check-ups on June 18, 2026 from 8:00 AM to 12:00 PM. Services include blood pressure monitoring, blood sugar testing, and general consultation.",
    type: "event",
    date: new Date("2026-05-30"),
    priority: "normal"
  },
  {
    id: 6,
    title: "Updated Certificate Processing Time",
    content: "We are pleased to announce that the average processing time for certificates has been reduced from 3 days to 1-2 business days. This improvement is part of our commitment to provide efficient service.",
    type: "info",
    date: new Date("2026-05-28"),
    priority: "low"
  }
];

export default function Announcements() {
  const getIcon = (type: Announcement["type"]) => {
    switch (type) {
      case "alert":
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
      case "event":
        return <Calendar className="w-4 h-4 text-muted-foreground" />;
      case "info":
      default:
        return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getBadgeVariant = (priority: Announcement["priority"]) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "normal":
        return "default";
      case "low":
        return "secondary";
    }
  };

  const getTypeLabel = (type: Announcement["type"]) => {
    switch (type) {
      case "alert":
        return "Alert";
      case "event":
        return "Event";
      case "info":
      default:
        return "Information";
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2>Announcements</h2>
        <p className="text-sm text-muted-foreground">Latest updates from the barangay</p>
      </div>

      <div className="space-y-3">
        {mockAnnouncements.map((announcement) => (
          <Card key={announcement.id}>
            <CardContent className="pt-4">
              <div className="flex gap-2 mb-2">
                <div className="flex items-center gap-2 flex-1">
                  <h3 className="text-sm">{announcement.title}</h3>
                  {announcement.priority === "high" && (
                    <Badge variant="destructive" className="text-xs">Important</Badge>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{format(announcement.date, "MMM dd, yyyy")}</p>
              <p className="text-sm text-muted-foreground">{announcement.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
