import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, ArrowLeft, Send, ShieldAlert, Loader2 } from "lucide-react";

const LOGO = "https://multipliersolutions.in/manipalhospitals/manipallogo2.png";

interface AccountOption {
    id: string;
    user: string;
    cluster?: string;
    branch?: string;
    name?: string;
}

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [multipleAccounts, setMultipleAccounts] = useState<AccountOption[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>("");
    const [isCheckingEmail, setIsCheckingEmail] = useState(false);
    const [hasCheckedEmail, setHasCheckedEmail] = useState(false);
    const navigate = useNavigate();

    const checkEmailAccess = async (emailToCheck: string) => {
        if (!emailToCheck || !/\S+@\S+\.\S+/.test(emailToCheck)) {
            setMultipleAccounts([]);
            setSelectedAccountId("");
            setHasCheckedEmail(false);
            return;
        }
        setIsCheckingEmail(true);
        try {
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://smldatamanagement.multiplierai.co";
            const response = await fetch(`${API_BASE_URL}/api/forgot-password/check`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailToCheck }),
            });
            const data = await response.json();
            if (data.success && data.multiple) {
                setMultipleAccounts(data.accounts);
                setSelectedAccountId(""); // Require user selection
            } else {
                setMultipleAccounts([]);
                setSelectedAccountId("");
            }
            setHasCheckedEmail(true);
        } catch (err) {
            console.error("Error checking email access:", err);
        } finally {
            setIsCheckingEmail(false);
        }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (email && /\S+@\S+\.\S+/.test(email)) {
                checkEmailAccess(email);
            } else {
                setMultipleAccounts([]);
                setSelectedAccountId("");
                setHasCheckedEmail(false);
            }
        }, 600);

        return () => clearTimeout(delayDebounceFn);
    }, [email]);

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setIsLoading(true);

        try {
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://smldatamanagement.multiplierai.co";
            
            let currentAccounts = multipleAccounts;
            let currentSelected = selectedAccountId;

            if (!hasCheckedEmail) {
                const checkResponse = await fetch(`${API_BASE_URL}/api/forgot-password/check`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                });
                const checkData = await checkResponse.json();
                setHasCheckedEmail(true);
                if (checkData.success && checkData.multiple) {
                    setMultipleAccounts(checkData.accounts);
                    currentAccounts = checkData.accounts;
                    setIsLoading(false);
                    toast.info("Please select an account access option");
                    return;
                }
            }

            if (currentAccounts.length > 0 && !currentSelected) {
                setIsLoading(false);
                toast.info("Please select which account you want to reset password for");
                return;
            }

            const response = await fetch(`${API_BASE_URL}/api/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    email, 
                    userId: currentSelected || undefined 
                }),
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
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).onerror = null;
                          (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
                        }}
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
                                        className="pl-10 pr-10 h-11"
                                        required
                                    />
                                    {isCheckingEmail && (
                                        <div className="absolute right-3 top-3.5">
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {multipleAccounts.length > 0 && (
                                <div className="space-y-3 border-t pt-4">
                                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                        <ShieldAlert className="h-4 w-4" />
                                        <Label className="text-sm font-semibold">Multiple Accounts Found</Label>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        This email is linked to multiple access units/clusters. Please select the one you want to reset password for:
                                    </p>
                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                        {multipleAccounts.map((account) => (
                                            <label
                                                key={account.id}
                                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                                    selectedAccountId === account.id
                                                        ? "border-[#48BEB9] bg-[#48BEB9]/5 shadow-sm"
                                                        : "border-muted bg-background/50 hover:bg-accent/40"
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="accountSelection"
                                                    value={account.id}
                                                    checked={selectedAccountId === account.id}
                                                    onChange={() => setSelectedAccountId(account.id)}
                                                    className="sr-only"
                                                />
                                                <div className="flex-1 text-left">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-semibold text-sm capitalize text-foreground">{account.user}</span>
                                                        {account.name && (
                                                            <span className="text-xs text-muted-foreground font-medium">{account.name}</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5 font-normal">
                                                        {account.cluster && (
                                                            <div>
                                                                <span className="font-medium text-foreground/80">Cluster:</span> {account.cluster}
                                                            </div>
                                                        )}
                                                        {account.branch && (
                                                            <div>
                                                                <span className="font-medium text-foreground/80">Branch:</span> {account.branch}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                                    selectedAccountId === account.id ? "border-[#48BEB9]" : "border-muted-foreground/50"
                                                }`}>
                                                    {selectedAccountId === account.id && (
                                                        <div className="h-2 w-2 rounded-full bg-[#48BEB9]" />
                                                    )}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="space-y-3">
                            <Button
                                type="submit"
                                className="w-full h-11 text-base font-semibold border-2 border-[#48BEB9] bg-transparent text-[#48BEB9] hover:bg-[#48BEB9] hover:text-white transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
                                disabled={isLoading || isCheckingEmail || (multipleAccounts.length > 0 && !selectedAccountId)}
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
