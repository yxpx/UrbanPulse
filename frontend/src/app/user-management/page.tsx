"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
    Shield,
    Users,
    UserPlus,
    Trash2,
    CheckCircle2,
    AlertTriangle,
    Lock,
    History,
    Key,
    Award,
    RefreshCw,
    ChevronDown
} from "lucide-react";
interface UserRecord {
    id: number;
    username: string;
    role: string;
    created_at: string;
}
interface AuditLogRecord {
    id: number;
    username: string;
    event_type: string;
    status: string;
    timestamp: string;
}
const ROLES_DESCRIPTION = [
    {
        role: "Administrator",
        color: "border-purple-500/30 bg-purple-500/10 text-purple-300",
        badge: "bg-purple-500/20 text-purple-300",
        description: "Full governance privileges. Authorizes user provisioning, inspects cryptographic logs, executes live CCTV detection tracking, and accesses deep neural network diagnostics."
    },
    {
        role: "Traffic Engineer",
        color: "border-blue-500/30 bg-blue-500/10 text-blue-300",
        badge: "bg-blue-500/20 text-blue-300",
        description: "Technical analytics privileges. Permits interaction with Spatio-Temporal Graph Neural Network models, feature attribution algorithms, route calculations, and live video feeds."
    },
    {
        role: "Field Operator",
        color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        badge: "bg-emerald-500/20 text-emerald-300",
        description: "Standard monitoring privileges. Grants read-only access to network congestion heatmaps, real-time speed predictions, and fastest route calculation planners."
    }
];
export default function UserManagementPage() {
    const { user } = useAuth();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    // Form state
    const [newUsername, setNewUsername] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [selectedRole, setSelectedRole] = useState("Traffic Engineer");
    const [creating, setCreating] = useState(false);
    const fetchSecurityData = async () => {
        if (!user || user.role !== "Administrator") {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError("");
        try {
            const headers = { Authorization: `Bearer ${user.access_token}` };
            const [usersRes, logsRes] = await Promise.all([
                fetch("http://localhost:8000/api/auth/users", { headers }),
                fetch("http://localhost:8000/api/auth/audit-logs", { headers })
            ]);
            if (usersRes.ok) {
                const userData = await usersRes.json();
                setUsers(userData);
            } else {
                throw new Error("Failed to retrieve user directory");
            }
            if (logsRes.ok) {
                const logData = await logsRes.json();
                setAuditLogs(logData);
            }
        } catch (err: any) {
            setError(err.message || "Failed to synchronize security registers");
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchSecurityData();
    }, [user]);
    if (!user || user.role !== "Administrator") {
        return (
            <div className="flex min-h-[75vh] flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 shadow-xl">
                    <Lock className="h-8 w-8" />
                </div>
                <h2 className="mt-6 text-xl font-bold tracking-tight text-white">
                    403 Forbidden - Administrator Exclusivity
                </h2>
                <p className="mt-2 max-w-md text-xs leading-relaxed text-zinc-400">
                    Your current session authorization role ({user?.role || "Unidentified"}) lacks the required security governance clearance to inspect user accounts or alter RBAC assignments.
                </p>
            </div>
        );
    }
    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");
        setCreating(true);
        try {
            const response = await fetch("http://localhost:8000/api/auth/users", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${user.access_token}`
                },
                body: JSON.stringify({
                    username: newUsername,
                    password: newPassword,
                    role: selectedRole
                })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || "Account provisioning rejected by server");
            }
            setSuccessMsg(`Operator account '${newUsername}' successfully provisioned with role '${selectedRole}'.`);
            setNewUsername("");
            setNewPassword("");
            fetchSecurityData();
        } catch (err: any) {
            setError(err.message || "Account provisioning failed");
        } finally {
            setCreating(false);
        }
    };
    const handleRevokeUser = async (userId: number, targetUsername: string) => {
        if (!confirm(`Are you certain you wish to revoke access for operator '${targetUsername}'?`)) return;
        try {
            const response = await fetch(`http://localhost:8000/api/auth/users/${userId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${user.access_token}` }
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Revocation request rejected");
            }
            setSuccessMsg(`Access privileges revoked for account '${targetUsername}'.`);
            fetchSecurityData();
        } catch (err: any) {
            setError(err.message || "Revocation instruction failed");
        }
    };
    return (
        <div className="space-y-8 pb-12">
            {/* Header Banner */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-zinc-800 pb-6">
                <div>
                    <div className="flex items-center gap-2.5">
                        <Shield className="h-6 w-6 text-purple-400" />
                        <h1 className="text-2xl font-bold tracking-tight text-white">
                            Access Control & RBAC Governance
                        </h1>
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-400">
                        Provision authenticated operators, configure role boundaries, and inspect cryptographic session registers.
                    </p>
                </div>
                <button
                    onClick={fetchSecurityData}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 focus:outline-none"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    <span>Refresh Database Registers</span>
                </button>
            </div>
            {/* Role Specifications Grid */}
            <div className="space-y-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-300">
                    <span>Defined Role Specifications & Operational Boundaries</span>
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {ROLES_DESCRIPTION.map((item) => (
                        <div
                            key={item.role}
                            className={`rounded-xl border p-5 shadow-lg backdrop-blur-sm transition ${item.color} bg-opacity-40`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold tracking-wide text-white">{item.role}</span>
                            </div>
                            <p className="mt-3 text-xs leading-relaxed text-zinc-300/90">
                                {item.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
            {/* Status Notifications */}
            {error && (
                <div className="flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-xs font-medium text-red-300">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
                    <span>{error}</span>
                </div>
            )}
            {successMsg && (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-300">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                    <span>{successMsg}</span>
                </div>
            )}
            {/* Provisioning and Users Directory Grid */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Provisioning Form */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl h-fit">
                    <div className="flex items-center gap-2.5 border-b border-zinc-800 pb-4">
                        <UserPlus className="h-5 w-5 text-emerald-400" />
                        <h2 className="text-sm font-semibold tracking-wide text-white">
                            Provision Operator Account
                        </h2>
                    </div>
                    <form onSubmit={handleCreateUser} className="mt-6 space-y-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                Operator Username
                            </label>
                            <input
                                type="text"
                                required
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                placeholder="e.g. j_smith"
                                className="mt-1.5 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                Cryptographic Passphrase
                            </label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Minimum 6 characters"
                                className="mt-1.5 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                Assigned Role Tier
                            </label>
                            <div className="relative mt-1.5">
                                <select
                                    value={selectedRole}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                    className="appearance-none block w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 pr-10 text-sm text-zinc-100 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                                >
                                    <option value="Administrator">Administrator</option>
                                    <option value="Traffic Engineer">Traffic Engineer</option>
                                    <option value="Field Operator">Field Operator</option>
                                </select>
                                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={creating}
                            className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-purple-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-purple-500 focus:outline-none disabled:opacity-50"
                        >
                            {creating ? (
                                <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    <span>Encrypting & Writing to SQLite...</span>
                                </>
                            ) : (
                                <>
                                    <Key className="h-4 w-4" />
                                    <span>Authorize & Register Operator</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>
                {/* Registered Operator Directory */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl lg:col-span-2">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                        <div className="flex items-center gap-2.5">
                            <Users className="h-5 w-5 text-blue-400" />
                            <h2 className="text-sm font-semibold tracking-wide text-white">
                                Registered Operator Directory
                            </h2>
                        </div>
                        <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-mono text-zinc-400">
                            Total Accounts: {users.length}
                        </span>
                    </div>
                    <div className="mt-6 overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-400">
                                <tr>
                                    <th className="pb-3 pr-4">ID</th>
                                    <th className="pb-3 pr-4">Username</th>
                                    <th className="pb-3 pr-4">Assigned Role</th>
                                    <th className="pb-3 pr-4">Created Timestamp</th>
                                    <th className="pb-3 text-right">Governance Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                                {users.map((u) => {
                                    const isRoot = u.username === "admin" && u.id === 1;
                                    let badgeColor = "bg-zinc-800 text-zinc-300";
                                    if (u.role === "Administrator") badgeColor = "bg-purple-500/20 text-purple-300 border border-purple-500/30";
                                    if (u.role === "Traffic Engineer") badgeColor = "bg-blue-500/20 text-blue-300 border border-blue-500/30";
                                    if (u.role === "Field Operator") badgeColor = "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
                                    return (
                                        <tr key={u.id} className="transition hover:bg-zinc-800/30">
                                            <td className="py-3 pr-4 font-mono text-zinc-500">#{u.id}</td>
                                            <td className="py-3 pr-4 font-bold text-white">{u.username}</td>
                                            <td className="py-3 pr-4">
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeColor}`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4 font-mono text-[11px] text-zinc-400">{u.created_at}</td>
                                            <td className="py-3 text-right">
                                                {isRoot ? (
                                                    <span className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-zinc-500 bg-zinc-900 border border-zinc-800">
                                                        <Lock className="h-3 w-3" /> Root Protected
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleRevokeUser(u.id, u.username)}
                                                        className="inline-flex items-center gap-1.5 rounded bg-red-600/20 border border-red-500/40 px-2.5 py-1 text-[11px] font-semibold text-red-300 transition hover:bg-red-600 hover:text-white"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        <span>Revoke Access</span>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {users.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-zinc-500">
                                            No registered operators located in SQLite registry.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {/* Security & Audit Logs Table */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                    <div className="flex items-center gap-2.5">
                        <History className="h-5 w-5 text-emerald-400" />
                        <h2 className="text-sm font-semibold tracking-wide text-white">
                            Cryptographic Session & Audit Log Register
                        </h2>
                    </div>
                    <span className="text-[11px] text-zinc-500">
                        Displaying latest 50 security transactions
                    </span>
                </div>
                <div className="mt-6 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-400">
                            <tr>
                                <th className="pb-3 pr-4">Log ID</th>
                                <th className="pb-3 pr-4">Operator</th>
                                <th className="pb-3 pr-4">Security Event</th>
                                <th className="pb-3 pr-4">Execution Status</th>
                                <th className="pb-3 text-right">Timestamp (UTC)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60 text-zinc-300 font-mono text-[11px]">
                            {auditLogs.map((log) => {
                                const isSuccess = log.status.includes("SUCCESS") || log.status.includes("TOKEN_ISSUED");
                                return (
                                    <tr key={log.id} className="transition hover:bg-zinc-800/30">
                                        <td className="py-2.5 pr-4 text-zinc-500">LOG-00{log.id}</td>
                                        <td className="py-2.5 pr-4 font-semibold text-zinc-200">{log.username}</td>
                                        <td className="py-2.5 pr-4 text-blue-300">{log.event_type}</td>
                                        <td className="py-2.5 pr-4">
                                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${isSuccess ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                                                {log.status}
                                            </span>
                                        </td>
                                        <td className="py-2.5 text-right text-zinc-400">{log.timestamp}</td>
                                    </tr>
                                );
                            })}
                            {auditLogs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-zinc-500">
                                        No security transactions recorded in audit table yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
