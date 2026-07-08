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

export interface Ticket {
    _id: string;
    ticketId: string;
    category: string;
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

export interface TeamMember {
    _id: string;
    name: string;
    email: string;
    cluster: string;
}

interface TicketContextType {
    tickets: Ticket[];
    team: TeamMember[];
    loading: boolean;
    isMultiplier: boolean;
    currentMultiplierTeamMember: TeamMember | null;
    createTicket: (form: FormData) => Promise<Ticket | null>;
    addTicketLog: (ticketId: string, form: FormData) => Promise<Ticket | null>;
    transferTicket: (ticketId: string, newAssigneeEmail: string, remarks: string) => Promise<Ticket | null>;
    refreshTickets: () => Promise<void>;
}

const TicketContext = createContext<TicketContextType | undefined>(undefined);

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"}/api`;

export const TicketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const { toast } = useToast();
    const [tickets, setTickets] = useState<Ticket[]>([]);
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

            // Check if logged-in user email is in Multiplier Team list
            const matchedMember = teamList.find(m => m.email.toLowerCase() === user.email.toLowerCase());
            if (matchedMember) {
                setIsMultiplier(true);
                setCurrentMultiplierTeamMember(matchedMember);
            } else {
                setIsMultiplier(false);
                setCurrentMultiplierTeamMember(null);
            }

            // 2. Fetch tickets with parameters
            const queryParams = new URLSearchParams({
                email: user.email,
                role: user.role,
                cluster: user.cluster || "",
                branch: user.branch || ""
            });

            const ticketsRes = await fetch(`${API_BASE_URL}/tickets?${queryParams.toString()}`);
            const ticketsData = await ticketsRes.json();
            if (ticketsData.success && ticketsData.data) {
                setTickets(ticketsData.data);
            }
        } catch (error) {
            console.error("Failed to load Ticket Management data:", error);
            toast({
                title: "Loading Error",
                description: "Failed to load GMB tickets data from server.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    }, [user, isAuthenticated, toast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const createTicket = async (formData: FormData): Promise<Ticket | null> => {
        try {
            const res = await fetch(`${API_BASE_URL}/tickets`, {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (data.success && data.data) {
                setTickets(prev => [data.data, ...prev]);
                toast({
                    title: "Ticket Raised Successfully",
                    description: `Ticket ID ${data.data.ticketId} has been created and assigned.`,
                });
                return data.data;
            } else {
                throw new Error(data.error || "Failed to create ticket");
            }
        } catch (error: any) {
            console.error("Error creating ticket:", error);
            toast({
                title: "Creation Failed",
                description: error.message || "An error occurred while creating GMB ticket.",
                variant: "destructive"
            });
            return null;
        }
    };

    const addTicketLog = async (ticketId: string, formData: FormData): Promise<Ticket | null> => {
        try {
            const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/logs`, {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (data.success && data.data) {
                // Update local tickets cache
                setTickets(prev => prev.map(t => t.ticketId === ticketId ? data.data : t));
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

    const transferTicket = async (ticketId: string, newAssigneeEmail: string, remarks: string): Promise<Ticket | null> => {
        if (!user) return null;
        try {
            const res = await fetch(`${API_BASE_URL}/tickets/${ticketId}/transfer`, {
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
                setTickets(prev => prev.map(t => t.ticketId === ticketId ? data.data : t));
                toast({
                    title: "Ticket Transferred",
                    description: `Ticket ${ticketId} has been reassigned.`,
                });
                return data.data;
            } else {
                throw new Error(data.error || "Failed to transfer ticket");
            }
        } catch (error: any) {
            console.error("Error transferring ticket:", error);
            toast({
                title: "Transfer Failed",
                description: error.message || "An error occurred while transferring ticket.",
                variant: "destructive"
            });
            return null;
        }
    };

    const refreshTickets = async () => {
        await loadData();
    };

    return (
        <TicketContext.Provider value={{
            tickets,
            team,
            loading,
            isMultiplier,
            currentMultiplierTeamMember,
            createTicket,
            addTicketLog,
            transferTicket,
            refreshTickets
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
