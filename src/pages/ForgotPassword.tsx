import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, ArrowLeft, Send } from "lucide-react";

const LOGO = "https://multipliersolutions.in/manipalhospitals/manipallogo2.png";

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const navigate = useNavigate();

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
            const response = await fetch(`${API_BASE_URL}/api/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (data.success) {
                setIsSent(true);
                toast.success("Reset link sent to your email");
            } else {
                toast.error(data.error || "Failed to send reset link");
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
                    <h2 className="text-2xl font-bold tracking-tight">Forgot Password</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                        {!isSent
                            ? "Enter your email to receive a password reset link"
                            : "Check your inbox for the reset link"}
                    </p>
                </div>

                {!isSent ? (
                    <form onSubmit={handleForgotPassword} className="space-y-5">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="name@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-10 h-11"
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Button
                                type="submit"
                                className="w-full h-11 text-base font-semibold border-2 border-[#48BEB9] bg-transparent text-[#48BEB9] hover:bg-[#48BEB9] hover:text-white transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
                                disabled={isLoading}
                            >
                                {isLoading ? "Sending..." : "Send Reset Link"}
                                {!isLoading && <Send className="ml-2 h-4 w-4" />}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full"
                                onClick={() => navigate("/login")}
                                disabled={isLoading}
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back to login
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="text-center space-y-6">
                        <div className="p-4 bg-primary/10 rounded-full inline-flex">
                            <Mail className="h-12 w-12 text-primary" />
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm">
                                Reset link sent to <span className="font-semibold text-foreground">{email}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                                The link will expire in 1 hour
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            className="w-full h-11"
                            onClick={() => navigate("/login")}
                        >
                            Back to Login
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

export default ForgotPassword;
