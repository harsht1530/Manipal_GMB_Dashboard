import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useToast } from "@/components/ui/use-toast";

export interface Attachment {
    filename: string;
    path: string;
}

export interface ActivityLog {
    _id?: string;
    timestamp: string;
    user: string;
    email: string;
    action: string;
    prevValue?: string;
    newValue?: string;
    remarks?: string;
    isInternal: boolean;
    attachments?: Attachment[];
}

export interface Request {
    _id: string;
    requestId: string;
    ticketId: string;
    category: string;
    requestType: string;
    ticketType: string;
    raisedBy: { name: string; email: string };
    assignedTo: { name: string; email: string };
    cluster: string;
    branch: string;
    dueDate: string;
    priority: string;
    status: 'Open' | 'In Progress' | 'Waiting for Client' | 'Waiting for Google' | 'Completed' | 'Closed' | 'Escalated';
    description: string;
    excelTemplate?: Attachment;
    attachments: Attachment[];
    activityLogs: ActivityLog[];
    createdAt: string;
    updatedAt: string;
}

export type Ticket = Request;

export interface TeamMember {
    _id: string;
    name: string;
    email: string;
    cluster: string;
    clusters?: string[];
}

interface TicketContextType {
    requests: Request[];
    tickets: Ticket[];
    team: TeamMember[];
    loading: boolean;
    isMultiplier: boolean;
    currentMultiplierTeamMember: TeamMember | null;
    createRequest: (form: FormData) => Promise<Request | null>;
    createTicket: (form: FormData) => Promise<Ticket | null>;
    addRequestLog: (requestId: string, form: FormData) => Promise<Request | null>;
    addTicketLog: (ticketId: string, form: FormData) => Promise<Ticket | null>;
    transferRequest: (requestId: string, newAssigneeEmail: string, remarks: string) => Promise<Request | null>;
    transferTicket: (ticketId: string, newAssigneeEmail: string, remarks: string) => Promise<Ticket | null>;
    refreshRequests: () => Promise<void>;
    refreshTickets: () => Promise<void>;
}

const TicketContext = createContext<TicketContextType | undefined>(undefined);

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"}/api`;

export const TicketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const { toast } = useToast();
    const [requests, setRequests] = useState<Request[]>([]);
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [isMultiplier, setIsMultiplier] = useState(false);
    const [currentMultiplierTeamMember, setCurrentMultiplierTeamMember] = useState<TeamMember | null>(null);

    const loadData = useCallback(async () => {
        if (!isAuthenticated || !user) return;
        setLoading(true);
        try {
            // 1. Fetch team members
            const teamRes = await fetch(`${API_BASE_URL}/multiplier-team`);
            const teamData = await teamRes.json();
            let teamList: TeamMember[] = [];
            if (teamData.success && teamData.data) {
                setTeam(teamData.data);
                teamList = teamData.data;
            }

            // Check if logged-in user email is in Multiplier Team list (multi-cluster support)
            const matchedMembers = teamList.filter(m => m && m.email && m.email.toLowerCase() === user.email.toLowerCase());
            if (matchedMembers.length > 0) {
                setIsMultiplier(true);
                const firstMatch = matchedMembers[0];
                const allClusters = matchedMembers.map(m => m.cluster).filter(Boolean);
                setCurrentMultiplierTeamMember({
                    _id: firstMatch._id,
                    name: firstMatch.name,
                    email: firstMatch.email,
                    cluster: firstMatch.cluster || "",
                    clusters: allClusters
                });
            } else {
                setIsMultiplier(false);
                setCurrentMultiplierTeamMember(null);
            }
        } catch (error) {
            console.error("Failed to load Request Management data:", error);
        } finally {
            setLoading(false);
        }
    }, [user, isAuthenticated]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const createRequest = async (formData: FormData): Promise<Request | null> => {
        try {
            const res = await fetch(`${API_BASE_URL}/requests`, {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (data.success && data.data) {
                setRequests(prev => [data.data, ...prev]);
                toast({
                    title: "Request Raised Successfully",
                    description: `Request ID ${data.data.requestId || data.data.ticketId} has been created and assigned.`,
                });
                return data.data;
            } else {
                throw new Error(data.error || "Failed to create request");
            }
        } catch (error: any) {
            console.error("Error creating request:", error);
            toast({
                title: "Creation Failed",
                description: error.message || "An error occurred while creating GMB request.",
                variant: "destructive"
            });
            return null;
        }
    };

    const addRequestLog = async (requestId: string, formData: FormData): Promise<Request | null> => {
        try {
            const res = await fetch(`${API_BASE_URL}/requests/${requestId}/logs`, {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (data.success && data.data) {
                setRequests(prev => prev.map(t => (t.requestId === requestId || t.ticketId === requestId) ? data.data : t));
                toast({
                    title: "Update Saved",
                    description: "Activity log has been added successfully.",
                });
                return data.data;
            } else {
                throw new Error(data.error || "Failed to add log");
            }
        } catch (error: any) {
            console.error("Error adding activity log:", error);
            toast({
                title: "Update Failed",
                description: error.message || "An error occurred while adding activity log.",
                variant: "destructive"
            });
            return null;
        }
    };

    const transferRequest = async (requestId: string, newAssigneeEmail: string, remarks: string): Promise<Request | null> => {
        if (!user) return null;
        try {
            const res = await fetch(`${API_BASE_URL}/requests/${requestId}/transfer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    transferByName: user.name,
                    transferByEmail: user.email,
                    newAssigneeEmail,
                    remarks
                })
            });
            const data = await res.json();
            if (data.success && data.data) {
                setRequests(prev => prev.map(t => (t.requestId === requestId || t.ticketId === requestId) ? data.data : t));
                toast({
                    title: "Request Transferred",
                    description: `Request ${requestId} has been reassigned.`,
                });
                return data.data;
            } else {
                throw new Error(data.error || "Failed to transfer request");
            }
        } catch (error: any) {
            console.error("Error transferring request:", error);
            toast({
                title: "Transfer Failed",
                description: error.message || "An error occurred while transferring request.",
                variant: "destructive"
            });
            return null;
        }
    };

    const refreshRequests = useCallback(async () => {
        if (!isAuthenticated || !user) return;
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                email: user.email,
                role: user.role,
                cluster: user.cluster || "",
                branch: user.branch || ""
            });

            const reqRes = await fetch(`${API_BASE_URL}/requests?${queryParams.toString()}`);
            const reqData = await reqRes.json();
            if (reqData.success && reqData.data) {
                setRequests(reqData.data);
            }
        } catch (error) {
            console.error("Failed to load GMB requests:", error);
            toast({
                title: "Loading Error",
                description: "Failed to load GMB requests data from server.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    }, [user, isAuthenticated, toast]);

    return (
        <TicketContext.Provider value={{
            requests,
            tickets: requests,
            team,
            loading,
            isMultiplier,
            currentMultiplierTeamMember,
            createRequest,
            createTicket: createRequest,
            addRequestLog,
            addTicketLog: addRequestLog,
            transferRequest,
            transferTicket: transferRequest,
            refreshRequests,
            refreshTickets: refreshRequests
        }}>
            {children}
        </TicketContext.Provider>
    );
};

export const useTickets = () => {
    const context = useContext(TicketContext);
    if (context === undefined) {
        throw new Error("useTickets must be used within a TicketProvider");
    }
    return context;
};

export const useRequests = useTickets;
export const RequestProvider = TicketProvider;

