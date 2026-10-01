import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { CheckCircle2, Clock, XCircle, Eye, Plus, Calendar, User, Phone, Mail, FileText } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Appointment {
  id: number;
  certificateType: string;
  fullName: string;
  contactNumber: string;
  email: string;
  address: string;
  purpose: string;
  preferredDate: Date;
  timeSlot: string;
  status: "pending" | "approved" | "rejected" | "completed";
  submittedDate: Date;
}

const mockAppointments: Appointment[] = [
  {
    id: 1,
    certificateType: "Barangay Clearance",
    fullName: "Juan Santos Dela Cruz",
    contactNumber: "0917-123-4567",
    email: "juan.delacruz@email.com",
    address: "123 Main Street, Subdivision A",
    purpose: "Employment requirement",
    preferredDate: new Date("2026-06-10"),
    timeSlot: "9:00 AM - 10:00 AM",
    status: "pending",
    submittedDate: new Date("2026-06-07")
  },
  {
    id: 2,
    certificateType: "Certificate of Indigency",
    fullName: "Maria Clara Reyes",
    contactNumber: "0918-234-5678",
    email: "",
    address: "456 Side Street, Sitio B",
    purpose: "Medical assistance",
    preferredDate: new Date("2026-06-09"),
    timeSlot: "10:00 AM - 11:00 AM",
    status: "approved",
    submittedDate: new Date("2026-06-06")
  },
  {
    id: 3,
    certificateType: "Certificate of Residency",
    fullName: "Pedro Aquino Santos",
    contactNumber: "0919-345-6789",
    email: "pedro.santos@email.com",
    address: "789 Back Street, Phase 2",
    purpose: "Business permit requirement",
    preferredDate: new Date("2026-06-11"),
    timeSlot: "2:00 PM - 3:00 PM",
    status: "pending",
    submittedDate: new Date("2026-06-07")
  },
  {
    id: 4,
    certificateType: "Business Permit Clearance",
    fullName: "Anna Marie Torres",
    contactNumber: "0920-456-7890",
    email: "anna.torres@email.com",
    address: "321 Corner Street, Village C",
    purpose: "New business application",
    preferredDate: new Date("2026-06-12"),
    timeSlot: "1:00 PM - 2:00 PM",
    status: "completed",
    submittedDate: new Date("2026-06-05")
  }
];

export default function AdminPanel() {
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    content: "",
    type: "info" as "info" | "alert" | "event",
    priority: "normal" as "high" | "normal" | "low"
  });

  const handleStatusUpdate = (appointmentId: number, newStatus: Appointment["status"]) => {
    setAppointments(prev =>
      prev.map(apt =>
        apt.id === appointmentId ? { ...apt, status: newStatus } : apt
      )
    );
    toast.success(`Appointment ${newStatus}`);
  };

  const handlePublishAnnouncement = () => {
    if (!newAnnouncement.title || !newAnnouncement.content) {
      toast.error("Please fill in all fields");
      return;
    }

    console.log("Publishing announcement:", newAnnouncement);
    toast.success("Announcement published successfully!");

    setNewAnnouncement({
      title: "",
      content: "",
      type: "info",
      priority: "normal"
    });
  };

  const getStatusBadge = (status: Appointment["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      case "approved":
        return <Badge variant="default">Approved</Badge>;
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
    }
  };

  const pendingCount = appointments.filter(a => a.status === "pending").length;
  const approvedCount = appointments.filter(a => a.status === "approved").length;
  const completedCount = appointments.filter(a => a.status === "completed").length;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h2>Admin Panel</h2>
        <p className="text-sm text-muted-foreground">Manage appointments and announcements</p>
      </div>

      <Tabs defaultValue="appointments" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="appointments">
            Appointments ({pendingCount})
          </TabsTrigger>
          <TabsTrigger value="announcements">
            Announcements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appointments">
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-card border rounded-lg p-3 text-center">
              <p className="text-2xl">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="bg-card border rounded-lg p-3 text-center">
              <p className="text-2xl">{approvedCount}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
            <div className="bg-card border rounded-lg p-3 text-center">
              <p className="text-2xl">{completedCount}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="bg-card border rounded-lg p-3 text-center">
              <p className="text-2xl">{appointments.length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Appointment Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Certificate Type</TableHead>
                    <TableHead>Preferred Date</TableHead>
                    <TableHead>Time Slot</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell className="font-medium">#{appointment.id}</TableCell>
                      <TableCell>{appointment.fullName}</TableCell>
                      <TableCell>{appointment.certificateType}</TableCell>
                      <TableCell>{format(appointment.preferredDate, "MMM dd, yyyy")}</TableCell>
                      <TableCell className="text-sm">{appointment.timeSlot}</TableCell>
                      <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedAppointment(appointment)}
                              >
                                View
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Appointment Details - #{selectedAppointment?.id}</DialogTitle>
                                <DialogDescription>
                                  Submitted on {selectedAppointment && format(selectedAppointment.submittedDate, "MMM dd, yyyy 'at' h:mm a")}
                                </DialogDescription>
                              </DialogHeader>
                              {selectedAppointment && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <p className="text-sm text-muted-foreground">Full Name</p>
                                      <p className="font-medium">{selectedAppointment.fullName}</p>
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-sm text-muted-foreground">Certificate Type</p>
                                      <p className="font-medium">{selectedAppointment.certificateType}</p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <p className="text-sm text-muted-foreground">Contact Number</p>
                                      <p className="font-medium">{selectedAppointment.contactNumber}</p>
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-sm text-muted-foreground">Email</p>
                                      <p className="font-medium">{selectedAppointment.email || "Not provided"}</p>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="text-sm text-muted-foreground">Address</div>
                                    <p className="font-medium">{selectedAppointment.address}</p>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="text-sm text-muted-foreground">Purpose</div>
                                    <p className="font-medium">{selectedAppointment.purpose}</p>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <p className="text-sm text-muted-foreground">Preferred Date</p>
                                      <p className="font-medium">{format(selectedAppointment.preferredDate, "MMMM dd, yyyy")}</p>
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-sm text-muted-foreground">Time Slot</p>
                                      <p className="font-medium">{selectedAppointment.timeSlot}</p>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">Status</p>
                                    {getStatusBadge(selectedAppointment.status)}
                                  </div>

                                  {selectedAppointment.status === "pending" && (
                                    <div className="flex gap-2 pt-4 border-t">
                                      <Button
                                        onClick={() => {
                                          handleStatusUpdate(selectedAppointment.id, "approved");
                                        }}
                                        className="flex-1"
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        onClick={() => {
                                          handleStatusUpdate(selectedAppointment.id, "rejected");
                                        }}
                                        variant="destructive"
                                        className="flex-1"
                                      >
                                        Reject
                                      </Button>
                                    </div>
                                  )}

                                  {selectedAppointment.status === "approved" && (
                                    <div className="pt-4 border-t">
                                      <Button
                                        onClick={() => {
                                          handleStatusUpdate(selectedAppointment.id, "completed");
                                        }}
                                        className="w-full"
                                      >
                                        Mark as Completed
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>

                          {appointment.status === "pending" && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleStatusUpdate(appointment.id, "approved")}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleStatusUpdate(appointment.id, "rejected")}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {appointment.status === "approved" && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleStatusUpdate(appointment.id, "completed")}
                            >
                              Complete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="announcements">
          <Card>
            <CardHeader>
              <CardTitle>Publish Announcement</CardTitle>
              <CardDescription>Create announcements for residents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="announcementTitle">Announcement Title *</Label>
                  <Input
                    id="announcementTitle"
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter announcement title"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="announcementType">Type</Label>
                    <Select
                      value={newAnnouncement.type}
                      onValueChange={(value: "info" | "alert" | "event") =>
                        setNewAnnouncement(prev => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Information</SelectItem>
                        <SelectItem value="alert">Alert</SelectItem>
                        <SelectItem value="event">Event</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="announcementPriority">Priority</Label>
                    <Select
                      value={newAnnouncement.priority}
                      onValueChange={(value: "high" | "normal" | "low") =>
                        setNewAnnouncement(prev => ({ ...prev, priority: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="announcementContent">Content *</Label>
                  <Textarea
                    id="announcementContent"
                    value={newAnnouncement.content}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Enter announcement content"
                    rows={6}
                  />
                </div>

                <Button onClick={handlePublishAnnouncement} className="w-full">
                  Publish
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
