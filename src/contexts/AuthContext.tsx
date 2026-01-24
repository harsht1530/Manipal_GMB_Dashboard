import React, { createContext, useContext, useState, useEffect } from "react";

export interface User {
    name: string;
    email: string;
    logo?: string;
    role: string; // "Admin", "Cluster", "Branch"
    cluster?: string;
    branch?: string;
    notifications?: {
        phoneChange: boolean;
        nameChange: boolean;
        monthlyReport: boolean;
    };
}

interface AuthContextType {
    user: User | null;
    login: (user: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const storedUser = localStorage.getItem("user");
        try {
            return storedUser ? JSON.parse(storedUser) : null;
        } catch (e) {
            console.error("Failed to parse stored user", e);
            return null;
        }
    });

    useEffect(() => {
        // This effect can be used for cross-tab sync if needed, 
        // but initial load is now handled in useState
    }, []);

    const login = (userData: User) => {
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));

        // Send login alert to backend
        // Super Admin (harsh@multipliersolutions.com) sees everything
        // Admin sees Cluster and Branch logins
        // Cluster sees Branch logins in their cluster

        // Don't send alert if the logging in user is HARSH (Super Admin)
        if (userData.email !== "harsh@multipliersolutions.com") {
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
            fetch(`${API_BASE_URL}/api/alerts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user: userData.name,
                    role: userData.role,
                    location: userData.role === "Branch" ? userData.branch : (userData.role === "Cluster" ? userData.cluster : "Dashboard"),
                    cluster: userData.cluster || null,
                    type: "LOGIN"
                })
            }).catch(err => console.error("Failed to trigger login alert:", err));
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem("user");
    };

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            isAuthenticated: !!user && !!(user.email || user.name)
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
