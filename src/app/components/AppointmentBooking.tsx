import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CalendarIcon, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const certificateTypes = [
  "Barangay Clearance",
  "Certificate of Residency",
  "Certificate of Indigency",
  "Business Permit Clearance",
  "Good Moral Certificate",
  "Community Tax Certificate (Cedula)"
];

const timeSlots = [
  "8:00 AM - 9:00 AM",
  "9:00 AM - 10:00 AM",
  "10:00 AM - 11:00 AM",
  "11:00 AM - 12:00 PM",
  "1:00 PM - 2:00 PM",
  "2:00 PM - 3:00 PM",
  "3:00 PM - 4:00 PM"
];

export default function AppointmentBooking() {
  const [date, setDate] = useState<Date>();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    certificateType: "",
    firstName: "",
    middleName: "",
    lastName: "",
    address: "",
    contactNumber: "",
    email: "",
    purpose: "",
    timeSlot: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.certificateType || !formData.firstName || !formData.lastName ||
        !formData.address || !formData.contactNumber || !formData.purpose || !date || !formData.timeSlot) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Simulate submission
    console.log("Appointment submitted:", { ...formData, date });
    setSubmitted(true);
    toast.success("Appointment request submitted successfully!");

    // Reset after 3 seconds
    setTimeout(() => {
      setSubmitted(false);
      setFormData({
        certificateType: "",
        firstName: "",
        middleName: "",
        lastName: "",
        address: "",
        contactNumber: "",
        email: "",
        purpose: "",
        timeSlot: ""
      });
      setDate(undefined);
    }, 3000);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (submitted) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-8 pb-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h2>Appointment Submitted</h2>
          <p className="text-muted-foreground mt-2">
            Your request has been received. You will receive confirmation within 24 hours.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Book Appointment</CardTitle>
        <CardDescription>
          Request a barangay certificate or clearance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Certificate Type */}
          <div className="space-y-2">
            <Label htmlFor="certificateType">Certificate Type *</Label>
            <Select value={formData.certificateType} onValueChange={(value) => handleInputChange("certificateType", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select certificate type" />
              </SelectTrigger>
              <SelectContent>
                {certificateTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Personal Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                placeholder="Juan"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="middleName">Middle Name</Label>
              <Input
                id="middleName"
                value={formData.middleName}
                onChange={(e) => handleInputChange("middleName", e.target.value)}
                placeholder="Santos"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange("lastName", e.target.value)}
                placeholder="Dela Cruz"
                required
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Complete Address *</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleInputChange("address", e.target.value)}
              placeholder="House No., Street, Subdivision/Sitio"
              required
            />
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactNumber">Contact Number *</Label>
              <Input
                id="contactNumber"
                type="tel"
                value={formData.contactNumber}
                onChange={(e) => handleInputChange("contactNumber", e.target.value)}
                placeholder="09XX-XXX-XXXX"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address (Optional)</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="juan.delacruz@email.com"
              />
            </div>
          </div>

          {/* Purpose */}
          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose *</Label>
            <Textarea
              id="purpose"
              value={formData.purpose}
              onChange={(e) => handleInputChange("purpose", e.target.value)}
              placeholder="State the purpose of your certificate request"
              rows={3}
              required
            />
          </div>

          {/* Date and Time Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Preferred Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">Office hours: Monday - Friday</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeSlot">Preferred Time Slot *</Label>
              <Select value={formData.timeSlot} onValueChange={(value) => handleInputChange("timeSlot", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select time slot" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm">
              <strong>Reminder:</strong> Bring valid ID and supporting documents. Processing takes 1-3 business days.
            </p>
          </div>

          <Button type="submit" className="w-full">
            Submit Request
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
