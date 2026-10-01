import { useState } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { RegisteredUser } from "../App";

interface RegisterFormProps {
  onRegister: (user: RegisteredUser) => void;
  onSuccess: () => void;
  registeredUsers: RegisteredUser[];
}

export default function RegisterForm({ onRegister, onSuccess, registeredUsers }: RegisterFormProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    contactNumber: "",
    address: "",
    password: "",
    confirmPassword: ""
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.firstName || !formData.lastName || !formData.email ||
        !formData.contactNumber || !formData.address || !formData.password) {
      toast.error("Please fill in all fields");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    // Check if email already exists
    const emailExists = registeredUsers.some(user => user.email === formData.email);
    if (emailExists) {
      toast.error("Email already registered. Please login.");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const newUser: RegisteredUser = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        contactNumber: formData.contactNumber,
        address: formData.address,
        password: formData.password
      };

      onRegister(newUser);
      toast.success("Registration successful! Please login.");
      onSuccess();
      setIsLoading(false);
    }, 500);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            placeholder="Juan"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            placeholder="Dela Cruz"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email Address *</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="juan.delacruz@email.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactNumber">Contact Number *</Label>
        <Input
          id="contactNumber"
          type="tel"
          value={formData.contactNumber}
          onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
          placeholder="09XX-XXX-XXXX"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Complete Address *</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="House No., Street, Barangay"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password *</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          placeholder="At least 6 characters"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password *</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          placeholder="Re-enter password"
          required
        />
      </div>

      <div className="bg-muted p-3 rounded-lg">
        <p className="text-xs text-muted-foreground">
          Your information will be used for appointment booking and verification purposes only.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Registering..." : "Register Account"}
      </Button>
    </form>
  );
}
