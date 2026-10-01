import { useState } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { User, Shield } from "lucide-react";
import { toast } from "sonner";
import { RegisteredUser } from "../App";

interface LoginFormProps {
  onLogin: (userType: "user" | "admin", name: string) => void;
  onPasswordReset: (email: string, newPassword: string) => void;
  registeredUsers: RegisteredUser[];
}

export default function LoginForm({ onLogin, onPasswordReset, registeredUsers }: LoginFormProps) {
  const [userCredentials, setUserCredentials] = useState({
    email: "",
    password: ""
  });

  const [adminCredentials, setAdminCredentials] = useState({
    username: "",
    password: ""
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<"verify" | "reset">("verify");
  const [resetData, setResetData] = useState({
    email: "",
    contactNumber: "",
    newPassword: "",
    confirmPassword: ""
  });

  const handleUserLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!userCredentials.email || !userCredentials.password) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const user = registeredUsers.find(
        u => u.email === userCredentials.email && u.password === userCredentials.password
      );

      if (user) {
        toast.success("Login successful!");
        onLogin("user", `${user.firstName} ${user.lastName}`);
      } else {
        toast.error("Invalid email or password");
      }
      setIsLoading(false);
    }, 500);
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!adminCredentials.username || !adminCredentials.password) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      if (adminCredentials.username === "admin" && adminCredentials.password === "admin123") {
        toast.success("Admin login successful");
        onLogin("admin", "Administrator");
      } else {
        toast.error("Invalid credentials");
      }
      setIsLoading(false);
    }, 500);
  };

  const handleVerifyUser = (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetData.email || !resetData.contactNumber) {
      toast.error("Please fill in all fields");
      return;
    }

    const user = registeredUsers.find(
      u => u.email === resetData.email && u.contactNumber === resetData.contactNumber
    );

    if (user) {
      setResetStep("reset");
      toast.success("Verification successful! Set your new password.");
    } else {
      toast.error("Email and contact number do not match our records");
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetData.newPassword || !resetData.confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (resetData.newPassword !== resetData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (resetData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    onPasswordReset(resetData.email, resetData.newPassword);
    toast.success("Password reset successful! You can now login.");
    setShowForgotPassword(false);
    setResetStep("verify");
    setResetData({
      email: "",
      contactNumber: "",
      newPassword: "",
      confirmPassword: ""
    });
  };

  return (
    <>
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forgot Password</DialogTitle>
            <DialogDescription>
              {resetStep === "verify"
                ? "Verify your identity to reset your password"
                : "Enter your new password"}
            </DialogDescription>
          </DialogHeader>

          {resetStep === "verify" ? (
            <form onSubmit={handleVerifyUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resetEmail">Email Address</Label>
                <Input
                  id="resetEmail"
                  type="email"
                  value={resetData.email}
                  onChange={(e) => setResetData({ ...resetData, email: e.target.value })}
                  placeholder="your.email@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resetContact">Contact Number</Label>
                <Input
                  id="resetContact"
                  type="tel"
                  value={resetData.contactNumber}
                  onChange={(e) => setResetData({ ...resetData, contactNumber: e.target.value })}
                  placeholder="09XX-XXX-XXXX"
                  required
                />
              </div>

              <div className="bg-muted p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Enter the email and contact number you used during registration.
                </p>
              </div>

              <Button type="submit" className="w-full">
                Verify Identity
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={resetData.newPassword}
                  onChange={(e) => setResetData({ ...resetData, newPassword: e.target.value })}
                  placeholder="At least 6 characters"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                <Input
                  id="confirmNewPassword"
                  type="password"
                  value={resetData.confirmPassword}
                  onChange={(e) => setResetData({ ...resetData, confirmPassword: e.target.value })}
                  placeholder="Re-enter password"
                  required
                />
              </div>

              <Button type="submit" className="w-full">
                Reset Password
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

    <Tabs defaultValue="user">
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="user">
          <User className="w-4 h-4 mr-2" />
          Resident
        </TabsTrigger>
        <TabsTrigger value="admin">
          <Shield className="w-4 h-4 mr-2" />
          Staff
        </TabsTrigger>
      </TabsList>

      <TabsContent value="user">
        <form onSubmit={handleUserLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="userEmail">Email Address</Label>
            <Input
              id="userEmail"
              type="email"
              value={userCredentials.email}
              onChange={(e) => setUserCredentials({ ...userCredentials, email: e.target.value })}
              placeholder="your.email@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="userPassword">Password</Label>
            <Input
              id="userPassword"
              type="password"
              value={userCredentials.password}
              onChange={(e) => setUserCredentials({ ...userCredentials, password: e.target.value })}
              placeholder="Enter your password"
              required
            />
          </div>

          {registeredUsers.length === 0 && (
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">
                No account yet? Click the <strong>Register</strong> tab to create one.
              </p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </Button>

          <div className="text-center">
            <Button
              type="button"
              variant="link"
              className="text-xs"
              onClick={() => {
                setShowForgotPassword(true);
                setResetStep("verify");
              }}
            >
              Forgot Password?
            </Button>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="admin">
        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adminUsername">Username</Label>
            <Input
              id="adminUsername"
              value={adminCredentials.username}
              onChange={(e) => setAdminCredentials({ ...adminCredentials, username: e.target.value })}
              placeholder="Enter username"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminPassword">Password</Label>
            <Input
              id="adminPassword"
              type="password"
              value={adminCredentials.password}
              onChange={(e) => setAdminCredentials({ ...adminCredentials, password: e.target.value })}
              placeholder="Enter password"
              required
            />
          </div>

          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Demo credentials:</strong><br />
              Username: admin<br />
              Password: admin123
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login as Staff"}
          </Button>
        </form>
      </TabsContent>
    </Tabs>
    </>
  );
}
