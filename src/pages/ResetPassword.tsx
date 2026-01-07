import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, Save, CheckCircle } from "lucide-react";

const LOGO = "https://multipliersolutions.in/manipalhospitals/manipallogo2.png";

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const navigate = useNavigate();

    const email = searchParams.get("email");
    const token = searchParams.get("token");

    useEffect(() => {
        if (!email || !token) {
            toast.error("Invalid or missing reset link parameters");
            navigate("/login");
        }
    }, [email, token, navigate]);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters long");
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch("http://localhost:5000/api/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, token, newPassword }),
            });

            const data = await response.json();

            if (data.success) {
                setIsSuccess(true);
                toast.success("Password reset successfully");
                setTimeout(() => navigate("/login"), 3000);
            } else {
                toast.error(data.error || "Failed to reset password");
            }
        } catch (err) {
            toast.error("Failed to connect to backend");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <img
                        src={LOGO}
                        alt="Logo"
                        className="h-14 mx-auto mb-6 object-contain"
                    />
                    <h2 className="text-2xl font-bold tracking-tight">Set New Password</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                        {!isSuccess
                            ? "Enter your new password below"
                            : "Your password has been updated successfully"}
                    </p>
                </div>

                {!isSuccess ? (
                    <form onSubmit={handleResetPassword} className="space-y-5">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">New Password</Label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="pl-10 pr-10 h-11"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        id="confirmPassword"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="pl-10 h-11"
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                        <Button
                            type="submit"
                            className="w-full h-11 text-base font-semibold"
                            disabled={isLoading}
                        >
                            {isLoading ? "Updating..." : "Update Password"}
                            {!isLoading && <Save className="ml-2 h-4 w-4" />}
                        </Button>
                    </form>
                ) : (
                    <div className="text-center space-y-6">
                        <div className="p-4 bg-green-100 rounded-full inline-flex">
                            <CheckCircle className="h-12 w-12 text-green-600" />
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">
                                Password updated successfully
                            </p>
                            <p className="text-xs text-muted-foreground italic">
                                Redirecting to login page...
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            className="w-full h-11"
                            onClick={() => navigate("/login")}
                        >
                            Login Now
                        </Button>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center pt-4">
                    <p className="text-xs text-muted-foreground">
                        © 2026 Multiplier AI. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
